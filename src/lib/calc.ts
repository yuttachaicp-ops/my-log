/** การคำนวณยอดทั้งหมดอยู่ในไฟล์นี้ไฟล์เดียว เพื่อให้เทสต์ครอบได้ครบ
 *  กฎที่ใช้ (ยืนยันกับเจ้าของระบบแล้วค่อยปรับได้):
 *    ยอดคงเหลือสะสม = ยอดยกมาต้นงวด + ผลรวมรายรับ − ผลรวมรายจ่าย ตั้งแต่ต้นจนถึงวันที่นั้น
 *    ยอดสุทธิของเดือน = รายรับเดือนนั้น − รายจ่ายเดือนนั้น
 */

import type {
  Account, AccountBalance, Category, CategoryTotal, DailyPoint, MonthSummary,
  RecurringItem, Transaction, TxFilter,
} from '../types';
import { daysInMonth, listDaysOfMonth, monthOf, parseISO, shiftMonth } from './date';
import { round2, sumMoney } from './money';

/** กรองรายการตามเงื่อนไขที่หน้าจอเลือกอยู่ */
export function filterTransactions(txs: Transaction[], f: TxFilter): Transaction[] {
  const q = (f.search || '').trim().toLowerCase();
  return txs.filter((t) => {
    if (f.month && monthOf(t.date) !== f.month) return false;
    if (f.type && f.type !== 'all' && t.type !== f.type) return false;
    if (f.categoryId && f.categoryId !== 'all' && t.categoryId !== f.categoryId) return false;
    if (f.accountId && f.accountId !== 'all'
        && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
    if (q) {
      const hay = (t.name + ' ' + (t.note || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function totalByType(txs: Transaction[], type: 'income' | 'expense'): number {
  // การโอนระหว่างบัญชีไม่ใช่รายรับและไม่ใช่รายจ่าย จึงไม่เข้าสูตรนี้โดยอัตโนมัติ
  // เพราะ t.type ของมันคือ 'transfer'
  return sumMoney(txs.filter((t) => t.type === type).map((t) => t.amount));
}

/** ยอดคงเหลือของแต่ละบัญชี นับถึงสิ้นเดือนที่ระบุ (เว้นว่าง = นับทุกรายการ)
 *  บัตรเครดิตใส่ openingBalance เป็นลบได้ ยอดติดลบจึงแปลว่ายังค้างจ่าย */
export function accountBalances(
  all: Transaction[], accounts: Account[], upToMonth?: string,
): AccountBalance[] {
  const rows = upToMonth ? all.filter((t) => monthOf(t.date) <= upToMonth) : all;
  return accounts
    .filter((a) => !a.archived)
    .map((a) => {
      let bal = a.openingBalance;
      for (const t of rows) {
        if (t.type === 'income' && t.accountId === a.id) bal += t.amount;
        else if (t.type === 'expense' && t.accountId === a.id) bal -= t.amount;
        else if (t.type === 'transfer') {
          if (t.accountId === a.id) bal -= t.amount;
          if (t.toAccountId === a.id) bal += t.amount;
        }
      }
      return {
        accountId: a.id, name: a.name, icon: a.icon, color: a.color, kind: a.kind,
        balance: round2(bal),
      };
    });
}

/** รายรับ รายจ่าย และผลต่าง ของชุดรายการที่ส่งเข้ามา */
export function totals(txs: Transaction[]): { income: number; expense: number; net: number } {
  const income = totalByType(txs, 'income');
  const expense = totalByType(txs, 'expense');
  return { income, expense, net: round2(income - expense) };
}

/** ยอดคงเหลือสะสมถึงสิ้นเดือนที่ระบุ รวมทุกเดือนก่อนหน้าด้วย */
export function closingBalance(
  all: Transaction[], month: string, openingBalance: number,
): number {
  const upto = all.filter((t) => monthOf(t.date) <= month);
  const { net } = totals(upto);
  return round2(openingBalance + net);
}

/** สรุปของเดือนเดียว */
export function monthSummary(
  all: Transaction[], month: string, openingBalance: number,
): MonthSummary {
  const inMonth = all.filter((t) => monthOf(t.date) === month);
  const { income, expense, net } = totals(inMonth);
  return {
    month, income, expense, net,
    closingBalance: closingBalance(all, month, openingBalance),
  };
}

/** เทียบกับเดือนก่อนหน้า คืนค่าเป็นสัดส่วน เช่น 0.082 = เพิ่มขึ้น 8.2%
 *  ถ้าเดือนก่อนเป็นศูนย์จะคืน null เพราะหารไม่ได้ ไม่ใช่ 0% */
export function changeRatio(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2((current - previous) / previous * 100) / 100;
}

/** ข้อมูลรายวันสำหรับกราฟเส้น/แท่ง ครบทุกวันของเดือนแม้วันที่ไม่มีรายการ */
export function dailySeries(all: Transaction[], month: string): DailyPoint[] {
  const byDate = new Map<string, { income: number; expense: number }>();
  for (const d of listDaysOfMonth(month)) byDate.set(d, { income: 0, expense: 0 });
  for (const t of all) {
    if (monthOf(t.date) !== month) continue;
    const slot = byDate.get(t.date);
    if (!slot) continue;
    // ข้ามการโอน ไม่งั้นจะถูกนับเป็นรายจ่ายทั้งที่เงินแค่ย้ายบัญชี
    if (t.type === 'transfer') continue;
    if (t.type === 'income') slot.income = round2(slot.income + t.amount);
    else slot.expense = round2(slot.expense + t.amount);
  }
  return [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
}

/** ยอดรายเดือนย้อนหลัง n เดือนนับรวมเดือนที่ส่งมา ใช้กับกราฟเส้นช่วงยาวและกราฟแท่ง */
export function monthlySeries(
  all: Transaction[], endMonth: string, count: number,
): { key: string; income: number; expense: number }[] {
  const out: { key: string; income: number; expense: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = shiftMonth(endMonth, -i);
    const inMonth = all.filter((t) => monthOf(t.date) === m);
    const { income, expense } = totals(inMonth);
    out.push({ key: m, income, expense });
  }
  return out;
}

/** แบ่งเดือนเป็นสัปดาห์ตามวันที่ 1-7, 8-14, 15-21, 22-28, 29-สิ้นเดือน
 *  ใช้วิธีนี้แทนสัปดาห์ตามปฏิทินเพราะอ่านง่ายกว่าเมื่อดูทีละเดือน */
export function weeklySeries(
  all: Transaction[], month: string,
): { key: string; label: string; income: number; expense: number }[] {
  const last = daysInMonth(month);
  const bounds: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, 28]];
  if (last > 28) bounds.push([29, last]);

  return bounds.map(([from, to], i) => {
    const rows = all.filter((t) => {
      if (monthOf(t.date) !== month) return false;
      const d = parseISO(t.date).d;
      return d >= from && d <= to;
    });
    const { income, expense } = totals(rows);
    return { key: `${month}-w${i + 1}`, label: `${from}–${to}`, income, expense };
  });
}

/** ยอดรายหมวด เรียงจากมากไปน้อย ใช้กับโดนัทและหน้าหมวดหมู่ */
export function categoryTotals(
  txs: Transaction[], categories: Category[], type: 'income' | 'expense' = 'expense',
): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    map.set(t.categoryId, round2((map.get(t.categoryId) || 0) + t.amount));
  }
  const grand = sumMoney([...map.values()]);
  const rows: CategoryTotal[] = [];
  for (const [categoryId, amount] of map) {
    const c = categories.find((x) => x.id === categoryId);
    rows.push({
      categoryId,
      name: c ? c.name : 'ไม่ระบุหมวด',
      icon: c ? c.icon : '•',
      color: c ? c.color : '#B9BFB8',
      amount,
      share: grand === 0 ? 0 : amount / grand,
      monthlyBudget: c?.monthlyBudget,
    });
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

export interface BudgetRow extends CategoryTotal {
  monthlyBudget: number;
  /** สัดส่วนที่ใช้ไปเทียบงบ อาจเกิน 1 ได้ */
  used: number;
  remaining: number;
  status: 'ok' | 'warn' | 'over';
}

/** แถวงบประมาณ เฉพาะหมวดที่ตั้งงบไว้ */
export function budgetRows(
  txs: Transaction[], categories: Category[],
): BudgetRow[] {
  const totalsByCat = categoryTotals(txs, categories, 'expense');
  return categories
    .filter((c) => c.type === 'expense' && !c.archived && (c.monthlyBudget || 0) > 0)
    .map((c) => {
      const hit = totalsByCat.find((t) => t.categoryId === c.id);
      const amount = hit ? hit.amount : 0;
      const budget = c.monthlyBudget as number;
      const used = budget === 0 ? 0 : amount / budget;
      return {
        categoryId: c.id, name: c.name, icon: c.icon, color: c.color,
        amount, share: hit ? hit.share : 0,
        monthlyBudget: budget,
        used,
        remaining: round2(budget - amount),
        status: used >= 1 ? 'over' : used >= 0.8 ? 'warn' : 'ok',
      } as BudgetRow;
    })
    .sort((a, b) => b.used - a.used);
}

/** กันรายการซ้ำตอนนำเข้าจากแหล่งอื่น เช่น LINE Bot ที่ส่งข้อความเดิมมาสองครั้ง */
/** เลื่อนวันครบกำหนดให้อยู่ในเดือนจริง เช่นตั้งวันที่ 31 แต่เดือนกุมภาพันธ์มี 28 วัน */
export function dueDateOf(month: string, dueDay: number): string {
  const last = daysInMonth(month);
  const d = Math.min(Math.max(1, Math.round(dueDay)), last);
  return `${month}-${String(d).padStart(2, '0')}`;
}

/** รายการประจำที่ยังไม่ได้บันทึกลงเดือนนี้
 *  ดูจาก recurringId ของรายการจริง ไม่ใช่ชื่อ เพราะผู้ใช้เปลี่ยนชื่อได้ */
export function pendingRecurring(
  all: Transaction[], recurring: RecurringItem[], month: string,
): RecurringItem[] {
  const posted = new Set(
    all.filter((t) => t.recurringId && monthOf(t.date) === month).map((t) => t.recurringId as string),
  );
  return recurring
    .filter((r) => r.active && !posted.has(r.id))
    .sort((a, b) => a.dueDay - b.dueDay);
}

/** รายการประจำของเดือนนี้ที่ใกล้ครบกำหนดหรือเลยกำหนดแล้ว ใช้ขึ้นแถบเตือน */
export function recurringAlerts(
  all: Transaction[], recurring: RecurringItem[], month: string,
  todayISO: string, leadDays = 3,
): { item: RecurringItem; due: string; daysLeft: number; late: boolean }[] {
  if (month !== todayISO.slice(0, 7)) return [];
  const today = Number(todayISO.slice(8, 10));
  return pendingRecurring(all, recurring, month)
    .map((item) => {
      const due = dueDateOf(month, item.dueDay);
      const daysLeft = Number(due.slice(8, 10)) - today;
      return { item, due, daysLeft, late: daysLeft < 0 };
    })
    .filter((x) => x.late || x.daysLeft <= leadDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function isDuplicate(existing: Transaction[], incoming: Transaction): boolean {
  if (incoming.externalId) {
    return existing.some(
      (t) => t.externalId && t.externalId === incoming.externalId && t.source === incoming.source,
    );
  }
  return existing.some(
    (t) =>
      t.date === incoming.date &&
      t.type === incoming.type &&
      round2(t.amount) === round2(incoming.amount) &&
      t.name.trim() === incoming.name.trim(),
  );
}
