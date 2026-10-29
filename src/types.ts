/** ชนิดข้อมูลกลางของ My Log — ใช้ร่วมกันทั้ง UI ชั้นข้อมูล และเทสต์ */

export type TxType = 'income' | 'expense';

/** ที่มาของรายการ เผื่อวันหน้าต่อกับ LINE Bot แล้วต้องกันรายการซ้ำ */
export type TxSource = 'ui' | 'line' | 'import' | 'sample';

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
  note?: string;
  source: TxSource;
  createdAt: string;
  updatedAt: string;
  /** id ฝั่งระบบต้นทาง เช่นรหัสข้อความจาก LINE ใช้กันบันทึกซ้ำ */
  externalId?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TxType;
  /** อิโมจิหรือตัวอักษรเดียวใช้เป็นไอคอน */
  icon: string;
  color: string;
  /** งบต่อเดือน หน่วยบาท ไม่ตั้งก็เว้นว่าง */
  monthlyBudget?: number;
  archived?: boolean;
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
  /** ยอดยกมาต้นงวด ใช้ในสูตรยอดคงเหลือสะสม */
  openingBalance: number;
  currency: 'THB';
  timezone: 'Asia/Bangkok';
}

/** ก้อนข้อมูลทั้งหมดของหนึ่งแหล่งข้อมูล */
export interface Dataset {
  transactions: Transaction[];
  categories: Category[];
  goals: SavingsGoal[];
  settings: Settings;
}

export interface TxFilter {
  /** YYYY-MM ถ้าเว้นว่างคือทุกเดือน */
  month?: string;
  type?: TxType | 'all';
  categoryId?: string | 'all';
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

export interface DailyPoint {
  date: string;
  income: number;
  expense: number;
}
