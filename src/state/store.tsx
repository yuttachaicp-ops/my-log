/** ศูนย์กลางสถานะของแอป โหลดข้อมูลจาก DataSource แล้วแจกให้ทุกหน้าจอ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import type { Category, Dataset, SavingsGoal, TxFilter } from '../types';
import {
  getDataSource, readMode, writeMode, type SourceMode,
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
  setMonth(m: string): void;
  setFilter(patch: Partial<TxFilter>): void;
  reload(): Promise<void>;
  pushToast(text: string, kind?: ToastKind): void;

  addTransaction(input: NewTransaction): Promise<boolean>;
  editTransaction(id: string, patch: TxPatch): Promise<boolean>;
  removeTransaction(id: string): Promise<boolean>;
  saveCategory(c: Category): Promise<boolean>;
  removeCategory(id: string): Promise<boolean>;
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

  const source = useMemo(() => getDataSource(mode), [mode]);

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
    setMode, setMonth, setFilter, reload, pushToast,

    addTransaction: (input) => run(() => source.createTransaction(input), 'บันทึกรายการแล้ว'),
    editTransaction: (id, patch) => run(() => source.updateTransaction(id, patch), 'แก้ไขรายการแล้ว'),
    removeTransaction: (id) => run(() => source.deleteTransaction(id), 'ลบรายการแล้ว'),
    saveCategory: (c) => run(() => source.saveCategory(c), 'บันทึกหมวดหมู่แล้ว'),
    removeCategory: (id) => run(() => source.deleteCategory(id), 'ลบหมวดหมู่แล้ว'),
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
