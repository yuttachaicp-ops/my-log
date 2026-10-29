/** การแสดงผลจำนวนเงิน หน่วยบาท สองตำแหน่งทศนิยมเสมอ */

const nf2 = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nf0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

/** 18420 -> "฿ 18,420.00" */
export function formatTHB(amount: number): string {
  return '฿ ' + nf2.format(round2(amount));
}

/** 18420 -> "18,420.00" ใช้ตอนมีสัญลักษณ์อยู่แล้ว */
export function formatAmount(amount: number): string {
  return nf2.format(round2(amount));
}

/** 18420 -> "฿18,420" ใช้บนแกนกราฟที่พื้นที่แคบ */
export function formatCompactTHB(amount: number): string {
  if (Math.abs(amount) >= 1000) return '฿' + nf0.format(Math.round(amount / 1000)) + 'k';
  return '฿' + nf0.format(Math.round(amount));
}

/** 0.082 -> "8.2%" */
export function formatPercent(ratio: number, digits = 1): string {
  if (!isFinite(ratio)) return '—';
  return (ratio * 100).toFixed(digits) + '%';
}

/** ปัดทศนิยมสองตำแหน่งแบบกันปัญหา floating point (0.1+0.2) */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** บวกเงินหลายก้อนโดยปัดทีละขั้น กันเศษสะสม */
export function sumMoney(values: number[]): number {
  return round2(values.reduce((a, b) => round2(a + b), 0));
}

/** แปลงสิ่งที่ผู้ใช้พิมพ์เป็นตัวเลข รับทั้ง "1,200" และ "1200.50" */
export function parseAmount(input: string | number): number | null {
  if (typeof input === 'number') return isFinite(input) ? round2(input) : null;
  const cleaned = String(input).replace(/[,\s฿]/g, '');
  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return isFinite(n) ? round2(n) : null;
}
