/** แหล่งข้อมูลที่เก็บในเครื่องผู้ใช้ (localStorage)
 *
 *  ใช้สองอินสแตนซ์คนละคีย์:
 *    - โหมดจริง   key = mylog.real.v1    ข้อมูลเงินจริงของผู้ใช้
 *    - โหมดตัวอย่าง key = mylog.sample.v1  ข้อมูลสมมติไว้ดูหน้าตา
 *  สลับโหมดไม่ทำให้ข้อมูลอีกฝั่งหาย เพราะคนละคีย์กันคนละก้อน
 *
 *  ตัวนี้ทำให้ข้อมูลไม่หายเมื่อ reload ตามเงื่อนไข Definition of done
 *  และเป็นที่พักข้อมูลระหว่างที่ยังไม่ได้ต่อ backend จริง */

import type {
  Account, Category, Dataset, RecurringItem, SavingsGoal, Transaction,
} from '../types';
import { AppError, newId, type DataSource, type NewTransaction, type TxPatch } from './source';
import { buildImportedDataset, type ImportMode } from './portable';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';
import { buildSampleDataset } from './sampleData';
import { isValidDateISO } from '../lib/date';
import { round2 } from '../lib/money';

const STORAGE_VERSION = 'v1';

function emptyDataset(): Dataset {
  return {
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    recurring: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function readStore(key: string): Dataset | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Dataset>;
    if (!parsed || !Array.isArray(parsed.transactions)) return null;

    // ข้อมูลที่บันทึกไว้ก่อนมีระบบบัญชีจะไม่มี accounts/recurring
    // เติมให้ และผูกรายการเก่าทั้งหมดไว้กับบัญชีแรก ยอดรายบัญชีจึงยังถูกต้อง
    const accounts = parsed.accounts?.length
      ? parsed.accounts
      : DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
    const fallbackAccount = accounts[0]?.id;
    const transactions = parsed.transactions.map((t) =>
      t.accountId || t.type === 'transfer' ? t : { ...t, accountId: fallbackAccount },
    );

    return {
      transactions,
      categories: parsed.categories?.length ? parsed.categories : emptyDataset().categories,
      accounts,
      recurring: parsed.recurring || [],
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

function validateTx(
  t: Pick<Transaction, 'name' | 'amount' | 'date' | 'categoryId' | 'type'>
    & Partial<Pick<Transaction, 'accountId' | 'toAccountId'>>,
): void {
  if (!t.name || !t.name.trim()) throw new AppError('กรุณาใส่ชื่อรายการ');
  if (!isFinite(t.amount) || t.amount <= 0) throw new AppError('จำนวนเงินต้องมากกว่า 0');
  if (!isValidDateISO(t.date)) throw new AppError('วันที่ไม่ถูกต้อง');
  if (t.type === 'transfer') {
    if (!t.accountId || !t.toAccountId) throw new AppError('การโอนต้องเลือกทั้งบัญชีต้นทางและปลายทาง');
    if (t.accountId === t.toAccountId) throw new AppError('บัญชีต้นทางกับปลายทางต้องคนละบัญชี');
    return; // การโอนไม่ต้องมีหมวดหมู่
  }
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

  async saveAccount(a: Account): Promise<Account> {
    if (!a.name.trim()) throw new AppError('กรุณาใส่ชื่อบัญชี');
    const saved: Account = {
      ...a,
      id: a.id || newId('acc'),
      name: a.name.trim(),
      openingBalance: round2(a.openingBalance || 0),
    };
    await this.mutate((d) => {
      const i = d.accounts.findIndex((x) => x.id === saved.id);
      if (i < 0) d.accounts.push(saved);
      else d.accounts[i] = saved;
    });
    return saved;
  }

  /** บัญชีที่ยังมีรายการอ้างอยู่จะถูกซ่อนแทนการลบ ข้อมูลเดิมจึงไม่เสีย */
  async deleteAccount(id: string): Promise<void> {
    await this.mutate((d) => {
      const i = d.accounts.findIndex((a) => a.id === id);
      if (i < 0) throw new AppError('ไม่พบบัญชีนี้');
      if (d.accounts.filter((a) => !a.archived).length <= 1) {
        throw new AppError('ต้องเหลือบัญชีอย่างน้อยหนึ่งบัญชี');
      }
      const used = d.transactions.some((t) => t.accountId === id || t.toAccountId === id);
      if (used) d.accounts[i] = { ...d.accounts[i], archived: true };
      else d.accounts.splice(i, 1);
    });
  }

  async saveRecurring(r: RecurringItem): Promise<RecurringItem> {
    if (!r.name.trim()) throw new AppError('กรุณาใส่ชื่อรายการ');
    if (!isFinite(r.amount) || r.amount <= 0) throw new AppError('จำนวนเงินต้องมากกว่า 0');
    if (!r.categoryId) throw new AppError('กรุณาเลือกหมวดหมู่');
    const day = Math.round(r.dueDay);
    if (!isFinite(day) || day < 1 || day > 31) throw new AppError('วันครบกำหนดต้องอยู่ระหว่าง 1 ถึง 31');
    const now = new Date().toISOString();
    const saved: RecurringItem = {
      ...r,
      id: r.id || newId('rec'),
      name: r.name.trim(),
      amount: round2(r.amount),
      dueDay: day,
      createdAt: r.createdAt || now,
      updatedAt: now,
    };
    await this.mutate((d) => {
      const i = d.recurring.findIndex((x) => x.id === saved.id);
      if (i < 0) d.recurring.push(saved);
      else d.recurring[i] = saved;
    });
    return saved;
  }

  async deleteRecurring(id: string): Promise<void> {
    await this.mutate((d) => {
      const i = d.recurring.findIndex((r) => r.id === id);
      if (i < 0) throw new AppError('ไม่พบรายการประจำนี้');
      d.recurring.splice(i, 1);
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
  async importJSON(text: string, mode: ImportMode = 'replace'): Promise<number> {
    const current = await this.load();
    const { next, added } = buildImportedDataset(text, current, mode, validateTx);
    writeStore(this.key, next);
    return added;
  }

  /** ล้างข้อมูลชุดนี้ทิ้งทั้งหมด กลับไปเป็นค่าเริ่มต้น */
  async clearAll(): Promise<void> {
    writeStore(this.key, this.isSample ? buildSampleDataset() : emptyDataset());
  }
}
