/** ข้อมูลตัวอย่างสำหรับดูหน้าตาแอปเท่านั้น
 *
 *  กฎสำคัญ: ทุกรายการในนี้มี source === 'sample' และถูกเก็บคนละ storage key
 *  กับข้อมูลจริง จึงไม่มีทางปนกัน ตัวเลขทั้งหมดสมมติขึ้น ไม่ใช่เงินจริงของใคร */

import type { Account, Dataset, RecurringItem, Transaction } from '../types';
import { currentMonth, shiftMonth } from '../lib/date';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';

const ts = '2026-01-01T00:00:00.000Z';

const SAMPLE_ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: 'เงินสด', kind: 'cash', icon: '💵', color: '#4E735F', openingBalance: 2000 },
  { id: 'acc_bank', name: 'บัญชีธนาคาร', kind: 'bank', icon: '🏦', color: '#2E75B6', openingBalance: 10000 },
  { id: 'acc_card', name: 'บัตรเครดิต', kind: 'credit', icon: '💳', color: '#D87965', openingBalance: 0 },
];

function tx(
  n: number, day: number, month: string, type: 'income' | 'expense',
  name: string, categoryId: string, amount: number, accountId = 'acc_bank',
): Transaction {
  return {
    id: `sample_${month}_${n}`,
    date: `${month}-${String(day).padStart(2, '0')}`,
    type, name, categoryId, amount, accountId,
    source: 'sample',
    createdAt: ts, updatedAt: ts,
  };
}

function monthSet(month: string, seed: number): Transaction[] {
  const k = 1 + seed * 0.08;
  return [
    tx(1, 1, month, 'income', 'เงินเดือน', 'cat_salary', 18000),
    tx(2, 3, month, 'income', 'ยอดโอน Shopee', 'cat_online', Math.round(6200 * k)),
    tx(3, 12, month, 'income', 'รอบวิ่งงานส่งของ', 'cat_delivery', Math.round(3100 * k)),
    tx(4, 24, month, 'income', 'ยอดโอน Lazada', 'cat_online', Math.round(1200 * k)),

    tx(5, 1, month, 'expense', 'ค่าเช่าห้อง', 'cat_home', 4500),
    tx(6, 2, month, 'expense', 'ค่าน้ำค่าไฟ', 'cat_home', Math.round(820 * k)),
    tx(7, 4, month, 'expense', 'ข้าวเที่ยง', 'cat_food', 60, 'acc_cash'),
    tx(8, 6, month, 'expense', 'กาแฟ', 'cat_food', 55, 'acc_cash'),
    tx(9, 8, month, 'expense', 'น้ำมันมอเตอร์ไซค์', 'cat_transport', 150, 'acc_cash'),
    {
      id: `sample_${month}_t1`,
      date: `${month}-09`,
      type: 'transfer',
      name: 'กดเงินสดจากธนาคาร',
      categoryId: '',
      amount: 2000,
      accountId: 'acc_bank',
      toAccountId: 'acc_cash',
      source: 'sample',
      createdAt: ts, updatedAt: ts,
    },
    tx(10, 11, month, 'expense', 'อาหารแมว', 'cat_pet', Math.round(680 * k)),
    tx(11, 14, month, 'expense', 'ข้าวเย็นกับเพื่อน', 'cat_food', 320),
    tx(12, 17, month, 'expense', 'ค่าเน็ตบ้าน', 'cat_home', 599),
    tx(13, 19, month, 'expense', 'เสื้อยืด', 'cat_shopping', Math.round(450 * k)),
    tx(14, 21, month, 'expense', 'ยาแก้ปวด', 'cat_health', 120),
    tx(15, 23, month, 'expense', 'น้ำมันมอเตอร์ไซค์', 'cat_transport', 150),
    tx(16, 26, month, 'expense', 'ของใช้เข้าบ้าน', 'cat_shopping', Math.round(760 * k)),
  ];
}

export function buildSampleDataset(now: Date = new Date()): Dataset {
  const m0 = currentMonth(now);
  const months = [shiftMonth(m0, -2), shiftMonth(m0, -1), m0];
  const transactions = months.flatMap((m, i) => monthSet(m, i));

  const categories = DEFAULT_CATEGORIES.map((c) => {
    const budgets: Record<string, number> = {
      cat_food: 4000, cat_transport: 1200, cat_home: 6500,
      cat_shopping: 1500, cat_pet: 900,
    };
    return budgets[c.id] ? { ...c, monthlyBudget: budgets[c.id] } : { ...c };
  });

  const recurring: RecurringItem[] = [
    { id: 'rec_rent', name: 'ค่าเช่าห้อง', type: 'expense', categoryId: 'cat_home',
      accountId: 'acc_bank', amount: 4500, dueDay: 1, active: true, createdAt: ts, updatedAt: ts },
    { id: 'rec_net', name: 'ค่าเน็ตบ้าน', type: 'expense', categoryId: 'cat_home',
      accountId: 'acc_bank', amount: 599, dueDay: 17, active: true, createdAt: ts, updatedAt: ts },
    { id: 'rec_card', name: 'ยอดบัตรเครดิต', type: 'expense', categoryId: 'cat_credit',
      accountId: 'acc_bank', amount: 6500, dueDay: 25, active: true, createdAt: ts, updatedAt: ts },
  ];

  return {
    transactions,
    categories,
    accounts: SAMPLE_ACCOUNTS.map((a) => ({ ...a })),
    recurring,
    goals: [
      { id: 'goal_sample_1', name: 'เก็บเงินซื้อกล้อง', targetAmount: 25000, savedAmount: 9400 },
      { id: 'goal_sample_2', name: 'เงินสำรองฉุกเฉิน', targetAmount: 50000, savedAmount: 21000 },
    ],
    settings: { ...DEFAULT_SETTINGS, openingBalance: 12000 },
  };
}
