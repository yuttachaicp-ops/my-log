/** ศูนย์กลางสถานะของแอป โหลดข้อมูลจาก DataSource แล้วแจกให้ทุกหน้าจอ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import type {
  Account, Category, Dataset, RecurringItem, SavingsGoal, TxFilter,
} from '../types';
import {
  getDataSource, readMode, resetSourceCache, writeMode, type SourceMode,
} from '../data';
import type { DataSource, NewTransaction, TxPatch } from '../data/source';
import { currentMonth } from '../lib/date';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: number; kind: ToastKind; text: string; }

interface StoreValue {
  mode: SourceMode;
  source: DataSource;
  data: Dataset | null;
  loading: boolean;
  error: string | null;
  month: string;
  filter: TxFilter;
  toasts: Toast[];

  setMode(m: SourceMode): void;
  refreshSource(): void;
  setMonth(m: string): void;
  setFilter(patch: Partial<TxFilter>): void;
  reload(): Promise<void>;
  pushToast(text: string, kind?: ToastKind): void;

  addTransaction(input: NewTransaction): Promise<boolean>;
  editTransaction(id: string, patch: TxPatch): Promise<boolean>;
  removeTransaction(id: string): Promise<boolean>;
  saveCategory(c: Category): Promise<boolean>;
  removeCategory(id: string): Promise<boolean>;
  saveAccount(a: Account): Promise<boolean>;
  removeAccount(id: string): Promise<boolean>;
  saveRecurring(r: RecurringItem): Promise<boolean>;
  removeRecurring(id: string): Promise<boolean>;
  postRecurring(ids: string[], month: string): Promise<boolean>;
  saveGoal(g: SavingsGoal): Promise<boolean>;
  removeGoal(id: string): Promise<boolean>;
  setOpeningBalance(n: number): Promise<boolean>;
}

const Ctx = createContext<StoreValue | null>(null);

function messageOf(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง';
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SourceMode>(() => readMode());
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [filter, setFilterState] = useState<TxFilter>({ type: 'all', categoryId: 'all', search: '' });
  const [toasts, setToasts] = useState<Toast[]>([]);

  // nonce ใช้บังคับให้สร้าง source ใหม่หลังเปลี่ยนการตั้งค่าคลาวด์หรือเข้าสู่ระบบ
  const [nonce, setNonce] = useState(0);
  const source = useMemo(() => {
    try {
      return getDataSource(mode);
    } catch {
      // ตั้งค่าคลาวด์ไม่ครบ ตกกลับมาใช้ข้อมูลในเครื่องแทนหน้าจอพัง
      return getDataSource('real');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, nonce]);

  const pushToast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await source.load());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => { void reload(); }, [reload]);

  const setMode = useCallback((m: SourceMode) => {
    writeMode(m);
    setModeState(m);
  }, []);

  /** เรียกหลังตั้งค่าคลาวด์ใหม่หรือเข้า/ออกจากระบบ เพื่อให้โหลดข้อมูลชุดใหม่ */
  const refreshSource = useCallback(() => {
    resetSourceCache();
    setNonce((n) => n + 1);
  }, []);

  const setFilter = useCallback((patch: Partial<TxFilter>) => {
    setFilterState((f) => ({ ...f, ...patch }));
  }, []);

  /** ห่อทุก action ให้จัดการ error และ refresh ที่เดียว */
  const run = useCallback(
    async (fn: () => Promise<unknown>, okText?: string): Promise<boolean> => {
      try {
        await fn();
        setData(await source.load());
        if (okText) pushToast(okText, 'success');
        return true;
      } catch (e) {
        pushToast(messageOf(e), 'error');
        return false;
      }
    },
    [source, pushToast],
  );

  const value: StoreValue = {
    mode, source, data, loading, error, month, filter, toasts,
    setMode, refreshSource, setMonth, setFilter, reload, pushToast,

    addTransaction: (input) => run(() => source.createTransaction(input), 'บันทึกรายการแล้ว'),
    editTransaction: (id, patch) => run(() => source.updateTransaction(id, patch), 'แก้ไขรายการแล้ว'),
    removeTransaction: (id) => run(() => source.deleteTransaction(id), 'ลบรายการแล้ว'),
    saveCategory: (c) => run(() => source.saveCategory(c), 'บันทึกหมวดหมู่แล้ว'),
    removeCategory: (id) => run(() => source.deleteCategory(id), 'ลบหมวดหมู่แล้ว'),
    saveAccount: (a) => run(() => source.saveAccount(a), 'บันทึกบัญชีแล้ว'),
    removeAccount: (id) => run(() => source.deleteAccount(id), 'ลบบัญชีแล้ว'),
    saveRecurring: (r) => run(() => source.saveRecurring(r), 'บันทึกรายการประจำแล้ว'),
    removeRecurring: (id) => run(() => source.deleteRecurring(id), 'ลบรายการประจำแล้ว'),

    /** สร้างรายการจริงของเดือนนั้นจากรายการประจำที่เลือก ทีเดียวหลายอัน */
    postRecurring: (ids, m) =>
      run(async () => {
        const d = await source.load();
        for (const id of ids) {
          const r = d.recurring.find((x) => x.id === id);
          if (!r) continue;
          const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
          const day = Math.min(Math.max(1, r.dueDay), last);
          await source.createTransaction({
            date: `${m}-${String(day).padStart(2, '0')}`,
            type: r.type,
            name: r.name,
            categoryId: r.categoryId,
            amount: r.amount,
            accountId: r.accountId,
            note: r.note,
            source: 'recurring',
            recurringId: r.id,
          });
        }
      }, 'บันทึกรายการประจำของเดือนนี้แล้ว'),
    saveGoal: (g) => run(() => source.saveGoal(g), 'บันทึกเป้าหมายแล้ว'),
    removeGoal: (id) => run(() => source.deleteGoal(id), 'ลบเป้าหมายแล้ว'),
    setOpeningBalance: (n) => run(() => source.setOpeningBalance(n), 'บันทึกยอดยกมาแล้ว'),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore ต้องอยู่ภายใต้ StoreProvider');
  return v;
}
