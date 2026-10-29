/** โครงสำหรับต่อกับระบบเดิม (Apps Script / Google Sheet ที่ LINE Bot เขียนอยู่)
 *
 *  สถานะตอนนี้: ยังไม่ได้ต่อ และยังไม่เปิดใช้งานในแอป
 *  เหตุผล: ยังไม่ได้เห็นซอร์ส Apps Script และ schema ของชีต จึงไม่รู้ว่า
 *          แท็บชื่ออะไร คอลัมน์เรียงยังไง และ endpoint รับพารามิเตอร์แบบไหน
 *          การเดาโครงสร้างแล้วเขียนทับข้อมูลจริงเสี่ยงเกินไป
 *
 *  เมื่อได้ schema แล้วต้องทำ 3 อย่าง
 *    1. เติม mapping ใน rowToTransaction / transactionToRow ให้ตรงคอลัมน์จริง
 *    2. ฝั่ง Apps Script เพิ่ม endpoint ที่รับ JSON (ดูรูปแบบคำขอด้านล่าง)
 *    3. เปิดใช้ใน data/index.ts โดยเพิ่ม 'appsscript' เข้าไปใน SourceMode
 *
 *  ห้ามใส่ key หรือ URL จริงในไฟล์นี้ ให้ผู้ใช้กรอกในหน้าตั้งค่าแล้วเก็บใน localStorage
 */

import type { Category, Dataset, SavingsGoal, Transaction } from '../types';
import { AppError, type DataSource, type NewTransaction, type TxPatch } from './source';

export interface AppsScriptConfig {
  /** Web app URL ที่ลงท้ายด้วย /exec */
  endpoint: string;
  /** คีย์ที่ระบบเดิมใช้ ผู้ใช้กรอกเอง ไม่ hardcode */
  key: string;
}

/** รูปแบบคำขอที่ฝั่ง Apps Script ต้องรองรับ (ข้อเสนอ ยังไม่ได้ตกลงกับระบบเดิม)
 *    POST { action, key, payload }
 *    action: 'list' | 'create' | 'update' | 'delete' | 'meta'
 *    ตอบกลับ { ok: boolean, data?: unknown, error?: string } */
type Action = 'list' | 'create' | 'update' | 'delete' | 'meta';

const NOT_READY =
  'ยังไม่ได้เชื่อมกับระบบเดิม ต้องดู schema ของ Google Sheet และซอร์ส Apps Script ก่อน';

export class AppsScriptDataSource implements DataSource {
  readonly label = 'ระบบเดิม (Apps Script)';
  readonly isSample = false;
  readonly readOnly = true;

  constructor(private config: AppsScriptConfig) {}

  /** @internal ใช้เมื่อเปิดการเชื่อมต่อจริง */
  // @ts-expect-error ยังไม่ถูกเรียกจนกว่าจะต่อระบบเดิม
  private async call(action: Action, payload?: unknown): Promise<unknown> {
    if (!this.config.endpoint || !this.config.key) throw new AppError(NOT_READY);
    const res = await fetch(this.config.endpoint, {
      method: 'POST',
      // text/plain เพื่อเลี่ยง preflight ที่ Apps Script ไม่ตอบ
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, key: this.config.key, payload }),
      redirect: 'follow',
    });
    const text = await res.text();
    let json: { ok?: boolean; data?: unknown; error?: string };
    try {
      json = JSON.parse(text);
    } catch {
      throw new AppError('ระบบเดิมตอบกลับมาไม่ใช่ JSON ตรวจการตั้งค่า deployment');
    }
    if (!json.ok) throw new AppError(json.error || 'ระบบเดิมแจ้งข้อผิดพลาด');
    return json.data;
  }

  /** ต้องเติมให้ตรงคอลัมน์จริงหลังเห็น schema */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error ยังไม่ถูกเรียกจนกว่าจะเติม mapping ตาม schema จริง
  private rowToTransaction(_row: unknown[]): Transaction {
    throw new AppError(NOT_READY);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error ยังไม่ถูกเรียกจนกว่าจะเติม mapping ตาม schema จริง
  private transactionToRow(_t: Transaction): unknown[] {
    throw new AppError(NOT_READY);
  }

  async load(): Promise<Dataset> { throw new AppError(NOT_READY); }
  async createTransaction(_input: NewTransaction): Promise<Transaction> { throw new AppError(NOT_READY); }
  async updateTransaction(_id: string, _patch: TxPatch): Promise<Transaction> { throw new AppError(NOT_READY); }
  async deleteTransaction(_id: string): Promise<void> { throw new AppError(NOT_READY); }
  async saveCategory(_c: Category): Promise<Category> { throw new AppError(NOT_READY); }
  async deleteCategory(_id: string): Promise<void> { throw new AppError(NOT_READY); }
  async saveGoal(_g: SavingsGoal): Promise<SavingsGoal> { throw new AppError(NOT_READY); }
  async deleteGoal(_id: string): Promise<void> { throw new AppError(NOT_READY); }
  async setOpeningBalance(_amount: number): Promise<void> { throw new AppError(NOT_READY); }
}
