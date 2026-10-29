import { describe, expect, it } from 'vitest';
import {
  budgetRows, categoryTotals, changeRatio, closingBalance, dailySeries,
  accountBalances, dueDateOf, filterTransactions, isDuplicate, monthlySeries,
  monthSummary, pendingRecurring, recurringAlerts, totals, weeklySeries,
} from '../lib/calc';
import { formatTHB, parseAmount, round2, sumMoney } from '../lib/money';
import { daysInMonth, formatMonthShortTH, formatMonthTH, isValidDateISO, shiftMonth } from '../lib/date';
import type { Account, Category, RecurringItem, Transaction } from '../types';

const ts = '2026-01-01T00:00:00.000Z';

function t(
  id: string, date: string, type: 'income' | 'expense',
  amount: number, categoryId = 'cat_food', name = 'รายการ',
): Transaction {
  return { id, date, type, name, categoryId, amount, source: 'ui', createdAt: ts, updatedAt: ts };
}

const CATS: Category[] = [
  { id: 'cat_food', name: 'อาหาร', type: 'expense', icon: '🍜', color: '#D87965', monthlyBudget: 1000 },
  { id: 'cat_home', name: 'ที่พัก', type: 'expense', icon: '🏠', color: '#4E735F', monthlyBudget: 5000 },
  { id: 'cat_salary', name: 'เงินเดือน', type: 'income', icon: '💼', color: '#4E735F' },
];

const SET: Transaction[] = [
  t('a', '2026-09-20', 'income', 5000, 'cat_salary'),
  t('b', '2026-10-01', 'income', 20000, 'cat_salary'),
  t('c', '2026-10-05', 'expense', 4500, 'cat_home'),
  t('d', '2026-10-05', 'expense', 120.5, 'cat_food'),
  t('e', '2026-10-18', 'expense', 879.5, 'cat_food'),
  t('f', '2026-11-02', 'expense', 300, 'cat_food'),
];

describe('การรวมเงิน', () => {
  it('ปัดทศนิยมสองตำแหน่งไม่เพี้ยนจาก floating point', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(sumMoney([120.5, 879.5])).toBe(1000);
  });

  it('อ่านตัวเลขที่ผู้ใช้พิมพ์ได้ทั้งมีและไม่มีลูกน้ำ', () => {
    expect(parseAmount('1,200')).toBe(1200);
    expect(parseAmount('฿ 1,200.50')).toBe(1200.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('แสดงผลเป็นบาทสองตำแหน่งเสมอ', () => {
    expect(formatTHB(18420)).toBe('฿ 18,420.00');
    expect(formatTHB(0)).toBe('฿ 0.00');
  });
});

describe('ยอดรายรับ รายจ่าย และยอดคงเหลือ', () => {
  it('รวมแยกตามประเภทถูกต้อง', () => {
    const inOct = SET.filter((x) => x.date.startsWith('2026-10'));
    const r = totals(inOct);
    expect(r.income).toBe(20000);
    expect(r.expense).toBe(5500);
    expect(r.net).toBe(14500);
  });

  it('ยอดคงเหลือสะสมรวมเดือนก่อนหน้าและยอดยกมา', () => {
    // ยกมา 1000 + ก.ย.(+5000) + ต.ค.(20000-5500) = 20500
    expect(closingBalance(SET, '2026-10', 1000)).toBe(20500);
  });

  it('ยอดคงเหลือไม่นับรายการของเดือนถัดไป', () => {
    const sep = closingBalance(SET, '2026-09', 0);
    expect(sep).toBe(5000);
  });

  it('monthSummary คืนทั้งยอดเดือนและยอดสะสม', () => {
    const s = monthSummary(SET, '2026-10', 1000);
    expect(s).toMatchObject({ month: '2026-10', income: 20000, expense: 5500, net: 14500 });
    expect(s.closingBalance).toBe(20500);
  });

  it('เดือนที่ไม่มีรายการให้ผลเป็นศูนย์ ไม่ใช่ NaN', () => {
    const s = monthSummary(SET, '2026-08', 500);
    expect(s.income).toBe(0);
    expect(s.expense).toBe(0);
    expect(s.closingBalance).toBe(500);
  });
});

describe('การเปรียบเทียบกับเดือนก่อน', () => {
  it('คำนวณสัดส่วนการเปลี่ยนแปลงได้', () => {
    expect(changeRatio(110, 100)).toBe(0.1);
    expect(changeRatio(90, 100)).toBe(-0.1);
  });

  it('เดือนก่อนเป็นศูนย์ต้องคืน null ไม่ใช่ 0 หรือ Infinity', () => {
    expect(changeRatio(500, 0)).toBeNull();
  });
});

describe('ตัวกรองและการค้นหา', () => {
  it('กรองตามเดือน ประเภท และหมวดหมู่', () => {
    expect(filterTransactions(SET, { month: '2026-10' })).toHaveLength(4);
    expect(filterTransactions(SET, { month: '2026-10', type: 'expense' })).toHaveLength(3);
    expect(filterTransactions(SET, { month: '2026-10', categoryId: 'cat_food' })).toHaveLength(2);
  });

  it('ค้นหาจากชื่อรายการแบบไม่สนตัวพิมพ์', () => {
    const list = [t('x', '2026-10-01', 'expense', 50, 'cat_food', 'Coffee ร้านโปรด')];
    expect(filterTransactions(list, { search: 'coffee' })).toHaveLength(1);
    expect(filterTransactions(list, { search: 'โปรด' })).toHaveLength(1);
    expect(filterTransactions(list, { search: 'ไม่มีคำนี้' })).toHaveLength(0);
  });

  it('type all กับ categoryId all ไม่กรองอะไรออก', () => {
    expect(filterTransactions(SET, { type: 'all', categoryId: 'all' })).toHaveLength(SET.length);
  });
});

describe('ยอดรายหมวดและงบประมาณ', () => {
  const inOct = SET.filter((x) => x.date.startsWith('2026-10'));

  it('รวมยอดรายหมวดและคิดสัดส่วนรวมได้ 100%', () => {
    const rows = categoryTotals(inOct, CATS, 'expense');
    expect(rows[0]).toMatchObject({ categoryId: 'cat_home', amount: 4500 });
    expect(rows[1]).toMatchObject({ categoryId: 'cat_food', amount: 1000 });
    expect(round2(rows.reduce((a, r) => a + r.share, 0))).toBe(1);
  });

  it('งบที่ใช้พอดีเป๊ะนับเป็นเกินงบ', () => {
    const rows = budgetRows(inOct, CATS);
    const food = rows.find((r) => r.categoryId === 'cat_food')!;
    expect(food.amount).toBe(1000);
    expect(food.used).toBe(1);
    expect(food.status).toBe('over');
    expect(food.remaining).toBe(0);
  });

  it('หมวดที่ยังไม่ใช้งบเลยถือว่าปกติ', () => {
    const rows = budgetRows([], CATS);
    expect(rows.every((r) => r.status === 'ok')).toBe(true);
  });
});

describe('ข้อมูลกราฟรายวัน', () => {
  it('มีครบทุกวันของเดือนแม้วันที่ไม่มีรายการ', () => {
    const s = dailySeries(SET, '2026-10');
    expect(s).toHaveLength(31);
    expect(s[0]).toMatchObject({ date: '2026-10-01', income: 20000, expense: 0 });
    expect(s[4]).toMatchObject({ date: '2026-10-05', expense: 4620.5 });
    expect(s[1]).toMatchObject({ income: 0, expense: 0 });
  });

  it('เดือนกุมภาพันธ์ปีอธิกสุรทินมี 29 วัน', () => {
    expect(daysInMonth('2028-02')).toBe(29);
    expect(dailySeries([], '2028-02')).toHaveLength(29);
  });
});

describe('ชุดข้อมูลรายเดือนและรายสัปดาห์ (กราฟแท่งและช่วงเวลา)', () => {
  it('monthlySeries คืนครบทุกเดือนในช่วง เรียงจากเก่าไปใหม่', () => {
    const s = monthlySeries(SET, '2026-10', 3);
    expect(s.map((x) => x.key)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(s[0]).toMatchObject({ income: 0, expense: 0 });
    expect(s[1]).toMatchObject({ income: 5000, expense: 0 });
    expect(s[2]).toMatchObject({ income: 20000, expense: 5500 });
  });

  it('monthlySeries ไม่ดึงเดือนถัดไปเข้ามา', () => {
    const s = monthlySeries(SET, '2026-10', 1);
    expect(s).toHaveLength(1);
    expect(s[0].expense).toBe(5500);
  });

  it('weeklySeries แบ่งเดือน 31 วันเป็น 5 ช่วง และยอดรวมเท่ากับทั้งเดือน', () => {
    const w = weeklySeries(SET, '2026-10');
    expect(w).toHaveLength(5);
    expect(w.map((x) => x.label)).toEqual(['1–7', '8–14', '15–21', '22–28', '29–31']);
    expect(round2(w.reduce((a, x) => a + x.expense, 0))).toBe(5500);
    expect(round2(w.reduce((a, x) => a + x.income, 0))).toBe(20000);
  });

  it('weeklySeries วางรายการลงช่วงที่ถูกต้อง', () => {
    const w = weeklySeries(SET, '2026-10');
    expect(w[0]).toMatchObject({ income: 20000, expense: 4620.5 }); // 1 และ 5 ต.ค.
    expect(w[2].expense).toBe(879.5);                               // 18 ต.ค.
    expect(w[4]).toMatchObject({ income: 0, expense: 0 });
  });

  it('เดือนกุมภาพันธ์ 28 วันได้ 4 ช่วง', () => {
    expect(weeklySeries([], '2027-02')).toHaveLength(4);
    expect(weeklySeries([], '2028-02')).toHaveLength(5);
  });
});

describe('ตัวช่วยวันที่', () => {
  it('เลื่อนเดือนข้ามปีได้', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('แสดงเดือนเป็นพุทธศักราช', () => {
    expect(formatMonthTH('2026-10')).toBe('ตุลาคม 2569');
  });

  it('ป้ายเดือนแบบสั้นบนแกนกราฟ', () => {
    expect(formatMonthShortTH('2026-10')).toBe('ต.ค. 69');
    expect(formatMonthShortTH('2027-01')).toBe('ม.ค. 70');
  });

  it('ตรวจวันที่ที่ไม่มีอยู่จริง', () => {
    expect(isValidDateISO('2026-02-30')).toBe(false);
    expect(isValidDateISO('2026-13-01')).toBe(false);
    expect(isValidDateISO('2026-10-28')).toBe(true);
  });
});

describe('การกันรายการซ้ำ (เตรียมไว้ตอนต่อ LINE Bot)', () => {
  it('ถือว่าซ้ำเมื่อ externalId ตรงกันและมาจากแหล่งเดียวกัน', () => {
    const existing = [{ ...t('a', '2026-10-01', 'expense', 60), source: 'line' as const, externalId: 'msg1' }];
    const incoming = { ...t('b', '2026-10-01', 'expense', 60), source: 'line' as const, externalId: 'msg1' };
    expect(isDuplicate(existing, incoming)).toBe(true);
  });

  it('ไม่มี externalId ให้เทียบวันที่ ประเภท ยอด และชื่อ', () => {
    const existing = [t('a', '2026-10-01', 'expense', 60, 'cat_food', 'ข้าวเที่ยง')];
    expect(isDuplicate(existing, t('b', '2026-10-01', 'expense', 60, 'cat_food', 'ข้าวเที่ยง'))).toBe(true);
    expect(isDuplicate(existing, t('c', '2026-10-01', 'expense', 61, 'cat_food', 'ข้าวเที่ยง'))).toBe(false);
  });
});


// ---------------------------------------------------------------- บัญชีและการโอน
const ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: 'เงินสด', kind: 'cash', icon: '💵', color: '#4E735F', openingBalance: 1000 },
  { id: 'acc_bank', name: 'ธนาคาร', kind: 'bank', icon: '🏦', color: '#2E75B6', openingBalance: 5000 },
  { id: 'acc_card', name: 'บัตรเครดิต', kind: 'credit', icon: '💳', color: '#D87965', openingBalance: -2000 },
];

function withAcc(t: Transaction, accountId: string): Transaction {
  return { ...t, accountId };
}

function transfer(id: string, date: string, amount: number, from: string, to: string): Transaction {
  return {
    id, date, type: 'transfer', name: 'โอน', categoryId: '', amount,
    accountId: from, toAccountId: to, source: 'ui', createdAt: ts, updatedAt: ts,
  };
}

describe('การโอนระหว่างบัญชี', () => {
  const set: Transaction[] = [
    withAcc(t('i1', '2026-10-01', 'income', 10000, 'cat_salary'), 'acc_bank'),
    withAcc(t('e1', '2026-10-02', 'expense', 500, 'cat_food'), 'acc_cash'),
    transfer('tr1', '2026-10-03', 2000, 'acc_bank', 'acc_cash'),
  ];

  it('ไม่ถูกนับเป็นรายรับหรือรายจ่าย ยอดสรุปจึงไม่เปลี่ยน', () => {
    const r = totals(set);
    expect(r.income).toBe(10000);
    expect(r.expense).toBe(500);
    expect(r.net).toBe(9500);
  });

  it('ยอดรวมทุกบัญชีไม่เปลี่ยนหลังโอน เงินแค่ย้ายที่', () => {
    const before = accountBalances(set.slice(0, 2), ACCOUNTS);
    const after = accountBalances(set, ACCOUNTS);
    const sum = (rows: { balance: number }[]) => round2(rows.reduce((a, r) => a + r.balance, 0));
    expect(sum(after)).toBe(sum(before));
  });

  it('ยอดแต่ละบัญชีขยับถูกทิศทาง', () => {
    const b = accountBalances(set, ACCOUNTS);
    const by = (id: string) => b.find((x) => x.accountId === id)!.balance;
    expect(by('acc_bank')).toBe(5000 + 10000 - 2000);
    expect(by('acc_cash')).toBe(1000 - 500 + 2000);
    expect(by('acc_card')).toBe(-2000);
  });

  it('บัตรเครดิตที่รูดเพิ่มยอดยิ่งติดลบ', () => {
    const swiped = [...set, withAcc(t('e2', '2026-10-05', 'expense', 1200, 'cat_shopping'), 'acc_card')];
    const b = accountBalances(swiped, ACCOUNTS);
    expect(b.find((x) => x.accountId === 'acc_card')!.balance).toBe(-3200);
  });

  it('นับยอดถึงสิ้นเดือนที่ระบุเท่านั้น', () => {
    const later = [...set, withAcc(t('e3', '2026-11-01', 'expense', 999, 'cat_food'), 'acc_cash')];
    const oct = accountBalances(later, ACCOUNTS, '2026-10');
    expect(oct.find((x) => x.accountId === 'acc_cash')!.balance).toBe(2500);
  });

  it('กรองตามบัญชีเห็นทั้งขาเข้าและขาออกของการโอน', () => {
    expect(filterTransactions(set, { accountId: 'acc_cash' })).toHaveLength(2);
    expect(filterTransactions(set, { accountId: 'acc_bank' })).toHaveLength(2);
  });

  it('กราฟรายวันไม่นับการโอนเป็นรายจ่าย', () => {
    const s = dailySeries(set, '2026-10');
    expect(s[2]).toMatchObject({ date: '2026-10-03', income: 0, expense: 0 });
  });
});

// ------------------------------------------------------------- รายการประจำ
const REC: RecurringItem[] = [
  { id: 'r_rent', name: 'ค่าเช่า', type: 'expense', categoryId: 'cat_home',
    amount: 4500, dueDay: 1, active: true, createdAt: ts, updatedAt: ts },
  { id: 'r_net', name: 'ค่าเน็ต', type: 'expense', categoryId: 'cat_home',
    amount: 599, dueDay: 20, active: true, createdAt: ts, updatedAt: ts },
  { id: 'r_off', name: 'ปิดใช้อยู่', type: 'expense', categoryId: 'cat_home',
    amount: 100, dueDay: 5, active: false, createdAt: ts, updatedAt: ts },
];

describe('รายการประจำทุกเดือน', () => {
  it('เดือนที่ยังไม่บันทึกอะไรเลย ค้างทุกตัวที่เปิดใช้', () => {
    const p = pendingRecurring([], REC, '2026-10');
    expect(p.map((x) => x.id)).toEqual(['r_rent', 'r_net']);
  });

  it('บันทึกแล้วหายจากรายการค้าง โดยดูจาก recurringId', () => {
    const posted: Transaction[] = [
      { ...t('x1', '2026-10-01', 'expense', 4500, 'cat_home'), recurringId: 'r_rent' },
    ];
    expect(pendingRecurring(posted, REC, '2026-10').map((x) => x.id)).toEqual(['r_net']);
  });

  it('บันทึกของเดือนก่อนไม่ทำให้เดือนนี้หลุดไป', () => {
    const posted: Transaction[] = [
      { ...t('x1', '2026-09-01', 'expense', 4500, 'cat_home'), recurringId: 'r_rent' },
    ];
    expect(pendingRecurring(posted, REC, '2026-10')).toHaveLength(2);
  });

  it('วันครบกำหนดที่เกินจำนวนวันของเดือนถูกเลื่อนมาวันสุดท้าย', () => {
    expect(dueDateOf('2026-10', 31)).toBe('2026-10-31');
    expect(dueDateOf('2027-02', 31)).toBe('2027-02-28');
    expect(dueDateOf('2026-10', 0)).toBe('2026-10-01');
  });

  it('เตือนทั้งตัวที่เลยกำหนดและตัวที่ใกล้ครบ เรียงตัวที่ค้างนานสุดขึ้นก่อน', () => {
    const a = recurringAlerts([], REC, '2026-10', '2026-10-19', 3);
    expect(a.map((x) => x.item.id)).toEqual(['r_rent', 'r_net']);
    expect(a[0]).toMatchObject({ daysLeft: -18, late: true });  // ค่าเช่าครบวันที่ 1 เลยมา 18 วัน
    expect(a[1]).toMatchObject({ daysLeft: 1, late: false });   // ค่าเน็ตครบพรุ่งนี้
  });

  it('ตัวที่ยังอีกไกลเกินช่วงเตือนไม่ขึ้น', () => {
    const a = recurringAlerts([], REC, '2026-10', '2026-10-10', 3);
    expect(a.map((x) => x.item.id)).toEqual(['r_rent']);  // เหลือค่าเช่าที่เลยกำหนด ส่วนค่าเน็ตอีก 10 วัน
  });

  it('เลยกำหนดแล้วต้องขึ้นเตือนด้วย', () => {
    const a = recurringAlerts([], REC, '2026-10', '2026-10-25', 3);
    expect(a.map((x) => x.item.id)).toEqual(['r_rent', 'r_net']);
    expect(a.every((x) => x.late)).toBe(true);
  });

  it('ดูเดือนอื่นที่ไม่ใช่เดือนปัจจุบันไม่ต้องเตือน', () => {
    expect(recurringAlerts([], REC, '2026-12', '2026-10-25', 3)).toHaveLength(0);
  });
});
