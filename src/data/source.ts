/** สัญญาของแหล่งข้อมูล — UI คุยกับ interface นี้เท่านั้น
 *  เปลี่ยนไปใช้ Apps Script / n8n / ฐานข้อมูลจริงทีหลัง แก้แค่ไฟล์ใน data/ ไม่ต้องแตะ UI */

import type {
  Account, Category, Dataset, RecurringItem, SavingsGoal, Transaction,
} from '../types';

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
export type TxPatch = Partial<Omit<Transaction, 'id' | 'createdAt'>>;

export interface DataSource {
  /** ชื่อที่เอาไปโชว์ให้ผู้ใช้รู้ว่ากำลังดูข้อมูลจากไหน */
  readonly label: string;
  /** true เมื่อเป็นข้อมูลตัวอย่าง ไม่ใช่เงินจริงของผู้ใช้ */
  readonly isSample: boolean;
  /** true เมื่อเขียนข้อมูลไม่ได้ เช่นโหมดอ่านอย่างเดียว */
  readonly readOnly: boolean;

  load(): Promise<Dataset>;

  createTransaction(input: NewTransaction): Promise<Transaction>;
  updateTransaction(id: string, patch: TxPatch): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  saveCategory(c: Category): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  saveAccount(a: Account): Promise<Account>;
  deleteAccount(id: string): Promise<void>;

  saveRecurring(r: RecurringItem): Promise<RecurringItem>;
  deleteRecurring(id: string): Promise<void>;

  saveGoal(g: SavingsGoal): Promise<SavingsGoal>;
  deleteGoal(id: string): Promise<void>;

  setOpeningBalance(amount: number): Promise<void>;
}

export function newId(prefix = 'tx'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/** ข้อผิดพลาดที่ตั้งใจให้ผู้ใช้เห็นข้อความตรง ๆ ได้ */
export class AppError extends Error {}
