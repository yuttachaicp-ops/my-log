/** แหล่งข้อมูลที่เก็บในเครื่องผู้ใช้ (localStorage)
 *
 *  ใช้สองอินสแตนซ์คนละคีย์:
 *    - โหมดจริง   key = mylog.real.v1    ข้อมูลเงินจริงของผู้ใช้
 *    - โหมดตัวอย่าง key = mylog.sample.v1  ข้อมูลสมมติไว้ดูหน้าตา
 *  สลับโหมดไม่ทำให้ข้อมูลอีกฝั่งหาย เพราะคนละคีย์กันคนละก้อน
 *
 *  ตัวนี้ทำให้ข้อมูลไม่หายเมื่อ reload ตามเงื่อนไข Definition of done
 *  และเป็นที่พักข้อมูลระหว่างที่ยังไม่ได้ต่อ backend จริง */

import type { Category, Dataset, SavingsGoal, Transaction } from '../types';
import { AppError, newId, type DataSource, type NewTransaction, type TxPatch } from './source';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';
import { buildSampleDataset } from './sampleData';
import { isValidDateISO } from '../lib/date';
import { round2 } from '../lib/money';

const STORAGE_VERSION = 'v1';

function emptyDataset(): Dataset {
  return {
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function readStore(key: string): Dataset | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Dataset;
    if (!parsed || !Array.isArray(parsed.transactions)) return null;
    return {
      transactions: parsed.transactions,
      categories: parsed.categories?.length ? parsed.categories : emptyDataset().categories,
      goals: parsed.goals || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch {
    return null;
  }
}

function writeStore(key: string, data: Dataset): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    throw new AppError('บันทึกข้อมูลลงเครื่องไม่สำเร็จ พื้นที่จัดเก็บอาจเต็มหรือถูกปิดไว้');
  }
}

function validateTx(t: Pick<Transaction, 'name' | 'amount' | 'date' | 'categoryId'>): void {
  if (!t.name || !t.name.trim()) throw new AppError('กรุณาใส่ชื่อรายการ');
  if (!isFinite(t.amount) || t.amount <= 0) throw new AppError('จำนวนเงินต้องมากกว่า 0');
  if (!isValidDateISO(t.date)) throw new AppError('วันที่ไม่ถูกต้อง');
  if (!t.categoryId) throw new AppError('กรุณาเลือกหมวดหมู่');
}

export class LocalDataSource implements DataSource {
  readonly label: string;
  readonly isSample: boolean;
  readonly readOnly = false;
  private key: string;

  constructor(mode: 'real' | 'sample') {
    this.isSample = mode === 'sample';
    this.label = this.isSample ? 'ข้อมูลตัวอย่าง' : 'ข้อมูลของฉัน (เก็บในเครื่อง)';
    this.key = `mylog.${mode}.${STORAGE_VERSION}`;
  }

  async load(): Promise<Dataset> {
    const existing = readStore(this.key);
    if (existing) return existing;
    const seed = this.isSample ? buildSampleDataset() : emptyDataset();
    writeStore(this.key, seed);
    return seed;
  }

  private async mutate(fn: (d: Dataset) => void): Promise<Dataset> {
    const d = await this.load();
    fn(d);
    writeStore(this.key, d);
    return d;
  }

  async createTransaction(input: NewTransaction): Promise<Transaction> {
    validateTx(input);
    const now = new Date().toISOString();
    const t: Transaction = {
      ...input,
      amount: round2(input.amount),
      name: input.name.trim(),
      id: newId('tx'),
      createdAt: now,
      updatedAt: now,
    };
    await this.mutate((d) => { d.transactions.push(t); });
    return t;
  }

  async updateTransaction(id: string, patch: TxPatch): Promise<Transaction> {
    let updated: Transaction | null = null;
    await this.mutate((d) => {
      const i = d.transactions.findIndex((t) => t.id === id);
      if (i < 0) throw new AppError('ไม่พบรายการที่ต้องการแก้ไข');
      const merged: Transaction = {
        ...d.transactions[i],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (patch.amount !== undefined) merged.amount = round2(patch.amount);
      if (patch.name !== undefined) merged.name = String(patch.name).trim();
      validateTx(merged);
      d.transactions[i] = merged;
      updated = merged;
    });
    return updated as unknown as Transaction;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.mutate((d) => {
      const i = d.transactions.findIndex((t) => t.id === id);
      if (i < 0) throw new AppError('ไม่พบรายการที่ต้องการลบ');
      d.transactions.splice(i, 1);
    });
  }

  async saveCategory(c: Category): Promise<Category> {
    if (!c.name.trim()) throw new AppError('กรุณาใส่ชื่อหมวดหมู่');
    const saved: Category = { ...c, id: c.id || newId('cat'), name: c.name.trim() };
    await this.mutate((d) => {
      const i = d.categories.findIndex((x) => x.id === saved.id);
      if (i < 0) d.categories.push(saved);
      else d.categories[i] = saved;
    });
    return saved;
  }

  /** ไม่ลบจริงถ้ายังมีรายการอ้างอยู่ เพื่อไม่ให้รายการเก่ากลายเป็นหมวดว่าง
   *  เปลี่ยนเป็นซ่อน (archived) แทน ข้อมูลเดิมจึงไม่สูญหาย */
  async deleteCategory(id: string): Promise<void> {
    await this.mutate((d) => {
      const used = d.transactions.some((t) => t.categoryId === id);
      const i = d.categories.findIndex((c) => c.id === id);
      if (i < 0) throw new AppError('ไม่พบหมวดหมู่นี้');
      if (used) d.categories[i] = { ...d.categories[i], archived: true };
      else d.categories.splice(i, 1);
    });
  }

  async saveGoal(g: SavingsGoal): Promise<SavingsGoal> {
    if (!g.name.trim()) throw new AppError('กรุณาใส่ชื่อเป้าหมาย');
    if (!isFinite(g.targetAmount) || g.targetAmount <= 0) {
      throw new AppError('ยอดเป้าหมายต้องมากกว่า 0');
    }
    const saved: SavingsGoal = {
      ...g,
      id: g.id || newId('goal'),
      name: g.name.trim(),
      targetAmount: round2(g.targetAmount),
      savedAmount: round2(Math.max(0, g.savedAmount || 0)),
    };
    await this.mutate((d) => {
      const i = d.goals.findIndex((x) => x.id === saved.id);
      if (i < 0) d.goals.push(saved);
      else d.goals[i] = saved;
    });
    return saved;
  }

  async deleteGoal(id: string): Promise<void> {
    await this.mutate((d) => {
      const i = d.goals.findIndex((g) => g.id === id);
      if (i < 0) throw new AppError('ไม่พบเป้าหมายนี้');
      d.goals.splice(i, 1);
    });
  }

  async setOpeningBalance(amount: number): Promise<void> {
    await this.mutate((d) => { d.settings.openingBalance = round2(amount); });
  }

  /** ส่งออกเป็น JSON ไว้สำรองหรือย้ายไป backend จริงทีหลัง */
  async exportJSON(): Promise<string> {
    return JSON.stringify(await this.load(), null, 2);
  }

  /** นำเข้าไฟล์ JSON ที่ส่งออกไว้ หรือไฟล์ที่เตรียมมาให้
   *
   *  mode 'replace' = ล้างของเดิมทิ้งทั้งหมดแล้วใช้ชุดใหม่
   *  mode 'merge'   = เก็บของเดิมไว้ แล้วเติมเฉพาะรายการที่ยังไม่มี (ดูจาก id)
   *
   *  ตรวจความถูกต้องทุกรายการก่อนเขียน ถ้ามีแถวไหนผิดจะไม่เขียนอะไรเลย
   *  เพื่อไม่ให้ข้อมูลเดิมหายไปแล้วได้ของใหม่ที่ไม่ครบ */
  async importJSON(text: string, mode: 'replace' | 'merge' = 'replace'): Promise<number> {
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

    const now = new Date().toISOString();
    const txs: Transaction[] = incoming.transactions.map((raw, i) => {
      const t = raw as Partial<Transaction>;
      const built: Transaction = {
        id: t.id || newId('tx'),
        date: String(t.date || ''),
        type: t.type === 'income' ? 'income' : 'expense',
        name: String(t.name || '').trim(),
        categoryId: String(t.categoryId || ''),
        amount: round2(Number(t.amount)),
        note: t.note ? String(t.note) : undefined,
        source: t.source || 'import',
        createdAt: t.createdAt || now,
        updatedAt: t.updatedAt || now,
        externalId: t.externalId,
      };
      try {
        validateTx(built);
      } catch (e) {
        const why = e instanceof Error ? e.message : 'ข้อมูลไม่ถูกต้อง';
        throw new AppError(`รายการลำดับที่ ${i + 1} ใช้ไม่ได้: ${why}`);
      }
      return built;
    });

    const current = await this.load();
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
      goals: mode === 'replace' ? (incoming.goals as SavingsGoal[]) || [] : current.goals,
      settings: { ...current.settings, ...(incoming.settings || {}) },
    };

    writeStore(this.key, next);
    return txs.length;
  }

  /** ล้างข้อมูลชุดนี้ทิ้งทั้งหมด กลับไปเป็นค่าเริ่มต้น */
  async clearAll(): Promise<void> {
    writeStore(this.key, this.isSample ? buildSampleDataset() : emptyDataset());
  }
}
