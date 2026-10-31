/** ตรรกะนำเข้า/ส่งออก JSON ที่ใช้ร่วมกันทุกแหล่งข้อมูล
 *
 *  เดิมตรรกะนี้ฝังอยู่ใน LocalDataSource ตัวเดียว หน้าตั้งค่าจึงตรวจด้วย
 *  `source instanceof LocalDataSource` ผลคือพออยู่โหมดคลาวด์แล้วกดนำเข้า
 *  ปุ่มเงียบไปเฉย ๆ ไม่มีข้อความบอกว่าทำไมไม่เกิดอะไรขึ้น
 *
 *  ย้ายมาไว้ตรงกลางแบบนี้ ทั้งโหมดในเครื่องและโหมดคลาวด์ใช้เส้นทางเดียวกัน
 *  กติกาการตรวจความถูกต้องจึงเหมือนกันเป๊ะ ไม่ต้องดูแลสองชุด */

import type {
  Account, Category, Dataset, RecurringItem, SavingsGoal, Transaction,
} from '../types';
import { AppError, newId } from './source';
import { round2 } from '../lib/money';

export type ImportMode = 'replace' | 'merge';

/** แหล่งข้อมูลที่ย้ายเข้าออกเป็นไฟล์ JSON ได้ */
export interface PortableSource {
  exportJSON(): Promise<string>;
  importJSON(text: string, mode?: ImportMode): Promise<number>;
}

/** ใช้แทนการเช็ก instanceof เพื่อให้หน้าจอไม่ต้องรู้จักคลาสไหนเป็นพิเศษ */
export function isPortableSource(s: unknown): s is PortableSource {
  const o = s as Partial<PortableSource> | null;
  return !!o && typeof o.exportJSON === 'function' && typeof o.importJSON === 'function';
}

/** อ่านไฟล์ JSON แล้วประกอบเป็นชุดข้อมูลใหม่ที่พร้อมเขียนลงแหล่งข้อมูล
 *
 *  ตรวจทุกรายการก่อน ถ้ามีแถวไหนผิดจะโยน error โดยยังไม่เขียนอะไรเลย
 *  เพื่อไม่ให้ข้อมูลเดิมหายแล้วได้ของใหม่มาไม่ครบ
 *
 *  mode 'replace' = ใช้ชุดใหม่แทนของเดิมทั้งหมด
 *  mode 'merge'   = เก็บของเดิมไว้ เติมเฉพาะรายการที่ id ยังไม่ซ้ำ */
export function buildImportedDataset(
  text: string,
  current: Dataset,
  mode: ImportMode,
  validate: (t: Transaction) => void,
): { next: Dataset; added: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError('ไฟล์นี้ไม่ใช่ JSON ที่อ่านได้');
  }

  const incoming = parsed as Partial<Dataset>;
  if (!incoming || !Array.isArray(incoming.transactions)) {
    throw new AppError('ไฟล์ไม่มีรายการ (transactions) ตรวจว่าเลือกไฟล์ถูกตัว');
  }

  // รายการที่ไฟล์ไม่ได้ระบุบัญชี ให้ผูกกับบัญชีแรกของชุดที่จะใช้จริง
  const incomingAccounts = incoming.accounts?.length ? incoming.accounts : null;
  const defaultAccountId =
    (incomingAccounts ? incomingAccounts[0]?.id : undefined) || current.accounts[0]?.id;

  const now = new Date().toISOString();
  const txs: Transaction[] = incoming.transactions.map((raw, i) => {
    const t = raw as Partial<Transaction>;
    const built: Transaction = {
      id: t.id || newId('tx'),
      date: String(t.date || ''),
      type: t.type === 'income' ? 'income' : t.type === 'transfer' ? 'transfer' : 'expense',
      name: String(t.name || '').trim(),
      categoryId: String(t.categoryId || ''),
      amount: round2(Number(t.amount)),
      note: t.note ? String(t.note) : undefined,
      accountId: t.accountId || defaultAccountId,
      toAccountId: t.toAccountId,
      recurringId: t.recurringId,
      source: t.source || 'import',
      createdAt: t.createdAt || now,
      updatedAt: t.updatedAt || now,
      externalId: t.externalId,
    };
    try {
      validate(built);
    } catch (e) {
      const why = e instanceof Error ? e.message : 'ข้อมูลไม่ถูกต้อง';
      throw new AppError(`รายการลำดับที่ ${i + 1} ใช้ไม่ได้: ${why}`);
    }
    return built;
  });

  const cats = Array.isArray(incoming.categories) && incoming.categories.length
    ? (incoming.categories as Category[])
    : current.categories;

  const next: Dataset = {
    transactions:
      mode === 'replace'
        ? txs
        : current.transactions.concat(
            txs.filter((t) => !current.transactions.some((x) => x.id === t.id)),
          ),
    categories: mode === 'replace' ? cats : current.categories,
    accounts:
      mode === 'replace' && incoming.accounts?.length
        ? (incoming.accounts as Account[])
        : current.accounts,
    recurring:
      mode === 'replace' ? ((incoming.recurring as RecurringItem[]) || []) : current.recurring,
    goals: mode === 'replace' ? (incoming.goals as SavingsGoal[]) || [] : current.goals,
    settings: { ...current.settings, ...(incoming.settings || {}) },
  };

  return { next, added: txs.length };
}
