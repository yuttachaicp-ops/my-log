/** ชนิดข้อมูลกลางของ My Log — ใช้ร่วมกันทั้ง UI ชั้นข้อมูล และเทสต์ */

/** 'transfer' คือการย้ายเงินระหว่างบัญชีของตัวเอง ไม่ใช่รายรับและไม่ใช่รายจ่าย
 *  ทุกที่ที่รวมยอดจึงต้องข้ามมันไป ไม่งั้นจะนับซ้ำทั้งสองฝั่ง */
export type TxType = 'income' | 'expense' | 'transfer';

/** ที่มาของรายการ เผื่อวันหน้าต่อกับ LINE Bot แล้วต้องกันรายการซ้ำ */
export type TxSource = 'ui' | 'line' | 'import' | 'sample' | 'recurring';

export type AccountKind = 'cash' | 'bank' | 'credit' | 'ewallet';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  icon: string;
  color: string;
  /** ยอดตั้งต้นของบัญชีนี้ สำหรับบัตรเครดิตใส่เป็นยอดติดลบได้ */
  openingBalance: number;
  archived?: boolean;
}

export interface Transaction {
  /** unique id ไม่ซ้ำข้ามแหล่งข้อมูล */
  id: string;
  /** วันที่แบบ YYYY-MM-DD ตามเวลาไทย */
  date: string;
  type: TxType;
  /** ชื่อรายการที่ผู้ใช้พิมพ์ */
  name: string;
  categoryId: string;
  /** หน่วยบาท เก็บเป็นจำนวนบวกเสมอ ทิศทางดูจาก type */
  amount: number;
  /** บัญชีที่เงินออกหรือเข้า ถ้าเป็น transfer คือบัญชีต้นทาง */
  accountId?: string;
  /** ปลายทางของการโอน ใช้เฉพาะ type === 'transfer' */
  toAccountId?: string;
  note?: string;
  source: TxSource;
  createdAt: string;
  updatedAt: string;
  /** id ฝั่งระบบต้นทาง เช่นรหัสข้อความจาก LINE ใช้กันบันทึกซ้ำ */
  externalId?: string;
  /** ถ้ารายการนี้เกิดจากรายการประจำ จะอ้างกลับไปที่ต้นทาง */
  recurringId?: string;
}

export interface Category {
  id: string;
  name: string;
  /** หมวดใช้กับรายรับหรือรายจ่าย การโอนไม่ต้องมีหมวด */
  type: 'income' | 'expense';
  /** อิโมจิหรือตัวอักษรเดียวใช้เป็นไอคอน */
  icon: string;
  color: string;
  /** งบต่อเดือน หน่วยบาท ไม่ตั้งก็เว้นว่าง */
  monthlyBudget?: number;
  archived?: boolean;
}

/** รายการที่ต้องจ่ายหรือรับทุกเดือนเป็นประจำ เช่นค่าเช่า ค่าเน็ต ยอดบัตร
 *  ตัวนี้เป็นแค่ "แม่แบบ" ยังไม่ใช่รายการจริง จนกว่าผู้ใช้จะกดบันทึกของเดือนนั้น */
export interface RecurringItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  categoryId: string;
  accountId?: string;
  amount: number;
  /** วันที่ของเดือนที่ครบกำหนด 1-31 ถ้าเดือนนั้นสั้นกว่าจะเลื่อนมาวันสุดท้าย */
  dueDay: number;
  note?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  /** YYYY-MM-DD */
  dueDate?: string;
}

/** ค่าที่ผู้ใช้ตั้งเอง */
export interface Settings {
  /** ยอดยกมาต้นงวด ใช้ในสูตรยอดคงเหลือสะสม (ภาพรวมทุกบัญชี) */
  openingBalance: number;
  currency: 'THB';
  timezone: 'Asia/Bangkok';
}

/** ก้อนข้อมูลทั้งหมดของหนึ่งแหล่งข้อมูล */
export interface Dataset {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  recurring: RecurringItem[];
  goals: SavingsGoal[];
  settings: Settings;
}

export interface TxFilter {
  /** YYYY-MM ถ้าเว้นว่างคือทุกเดือน */
  month?: string;
  type?: TxType | 'all';
  categoryId?: string | 'all';
  accountId?: string | 'all';
  /** ค้นจากชื่อรายการและหมายเหตุ */
  search?: string;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  /** รายรับ − รายจ่าย ของเดือนนั้น */
  net: number;
  /** ยอดยกมา + สะสมทุกเดือนจนถึงสิ้นเดือนนั้น */
  closingBalance: number;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  /** สัดส่วนต่อยอดรวม 0–1 */
  share: number;
  monthlyBudget?: number;
}

export interface AccountBalance {
  accountId: string;
  name: string;
  icon: string;
  color: string;
  kind: AccountKind;
  /** ยอดตั้งต้น + เข้า − ออก + โอนเข้า − โอนออก ถึงสิ้นเดือนที่ดูอยู่ */
  balance: number;
}

export interface DailyPoint {
  date: string;
  income: number;
  expense: number;
}
