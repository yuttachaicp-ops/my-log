/** วันที่ทั้งหมดในแอปยึดเวลาไทย (Asia/Bangkok) และเก็บเป็นสตริง YYYY-MM-DD
 *  ตั้งใจไม่ใช้ new Date() ตรง ๆ กับสตริงเปล่า เพราะเบราว์เซอร์ตีความต่างกัน */

export const TZ = 'Asia/Bangkok';

const TH_MONTH_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const TH_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** วันนี้ตามเวลาไทย เป็น YYYY-MM-DD */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return parts; // en-CA ให้รูปแบบ YYYY-MM-DD อยู่แล้ว
}

/** เดือนปัจจุบันตามเวลาไทย เป็น YYYY-MM */
export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

/** "2026-10-28" -> "2026-10" */
export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** แตกสตริงเป็นตัวเลข โดยไม่พึ่ง timezone ของเครื่อง */
export function parseISO(dateISO: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateISO.split('-').map(Number);
  return { y, m, d: d || 1 };
}

/** จำนวนวันในเดือนนั้น */
export function daysInMonth(month: string): number {
  const { y, m } = parseISO(month + '-01');
  return new Date(y, m, 0).getDate();
}

/** เลื่อนเดือนไปข้างหน้า/ข้างหลัง "2026-10" + (-1) -> "2026-09" */
export function shiftMonth(month: string, delta: number): string {
  const { y, m } = parseISO(month + '-01');
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-10" -> "ตุลาคม 2569" (พุทธศักราช) */
export function formatMonthTH(month: string): string {
  const { y, m } = parseISO(month + '-01');
  return `${TH_MONTH_FULL[m - 1]} ${y + 543}`;
}

/** "2026-10-28" -> "28 ต.ค. 2569" */
export function formatDateTH(dateISO: string): string {
  const { y, m, d } = parseISO(dateISO);
  return `${d} ${TH_MONTH_SHORT[m - 1]} ${y + 543}`;
}

/** "2026-10" -> "ต.ค. 69" ใช้บนแกนกราฟที่พื้นที่น้อย */
export function formatMonthShortTH(month: string): string {
  const { y, m } = parseISO(month + '-01');
  return `${TH_MONTH_SHORT[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}`;
}

/** "2026-10-28" -> "28 ต.ค." ใช้ในกราฟที่พื้นที่น้อย */
export function formatDayShortTH(dateISO: string): string {
  const { m, d } = parseISO(dateISO);
  return `${d} ${TH_MONTH_SHORT[m - 1]}`;
}

/** รายการวันทั้งเดือนแบบ YYYY-MM-DD */
export function listDaysOfMonth(month: string): string[] {
  const n = daysInMonth(month);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) out.push(`${month}-${String(i).padStart(2, '0')}`);
  return out;
}

/** ตรวจว่าเป็น YYYY-MM-DD ที่มีอยู่จริง */
export function isValidDateISO(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const { y, m, d } = parseISO(v);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= new Date(y, m, 0).getDate();
}
