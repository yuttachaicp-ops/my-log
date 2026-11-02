/** บัตรเครดิต — ยอดค้างชำระ วงเงิน วันครบกำหนด และการจ่ายบิล
 *
 *  จุดที่ต้องไม่พลาดคือ "จ่ายบิลแล้วต้องไม่ถูกนับเป็นรายจ่ายซ้ำ"
 *  เพราะตอนรูดบัตรนับไปแล้วครั้งหนึ่ง ถ้านับตอนจ่ายอีกงบเดือนนั้นจะบวมเป็นสองเท่า */

import { describe, expect, it } from 'vitest';
import { creditCardAlerts, creditCardRows, monthSummary } from '../lib/calc';
import type { Account, Transaction } from '../types';

const ts = '2026-01-01T00:00:00.000Z';

const BANK: Account = {
  id: 'acc_bank', name: 'บัญชีธนาคาร', kind: 'bank', icon: '🏦', color: '#2E75B6',
  openingBalance: 50000,
};
const OWN: Account = {
  id: 'acc_own', name: 'บัตรส่วนตัว', kind: 'credit', icon: '💳', color: '#D87965',
  openingBalance: 0, shared: false, creditLimit: 50000, dueDay: 25,
};
const SHARED: Account = {
  id: 'acc_shared', name: 'Visa ร่วมกัน', kind: 'credit', icon: '💳', color: '#B98FA6',
  openingBalance: 0, shared: true, dueDay: 31,
};

function swipe(id: string, day: string, amount: number, accountId: string): Transaction {
  return {
    id, date: day, type: 'expense', name: 'รูดบัตร', categoryId: 'cat_shopping',
    amount, accountId, source: 'ui', createdAt: ts, updatedAt: ts,
  };
}

function payBill(id: string, day: string, amount: number, cardId: string): Transaction {
  return {
    id, date: day, type: 'transfer', name: 'จ่ายบิล', categoryId: '',
    amount, accountId: 'acc_bank', toAccountId: cardId,
    source: 'ui', createdAt: ts, updatedAt: ts,
  };
}

const ACCOUNTS = [BANK, OWN, SHARED];

describe('creditCardRows', () => {
  it('รูดบัตรแล้วยอดค้างเพิ่มตามจริง และเป็นเลขบวกเสมอ', () => {
    const txs = [swipe('t1', '2026-10-05', 17841.78, 'acc_own')];
    const rows = creditCardRows(txs, ACCOUNTS, '2026-10');
    const own = rows.find((r) => r.account.id === 'acc_own')!;
    expect(own.outstanding).toBe(17841.78);
    expect(own.spentThisMonth).toBe(17841.78);
    expect(own.paidThisMonth).toBe(0);
  });

  it('แยกบัตรส่วนตัวกับบัตรใช้ร่วมกันออกจากกัน ไม่ปนยอด', () => {
    const txs = [
      swipe('t1', '2026-10-05', 17841.78, 'acc_own'),
      swipe('t2', '2026-10-06', 4663.5, 'acc_shared'),
    ];
    const rows = creditCardRows(txs, ACCOUNTS, '2026-10');
    expect(rows.find((r) => r.account.id === 'acc_own')!.outstanding).toBe(17841.78);
    expect(rows.find((r) => r.account.id === 'acc_shared')!.outstanding).toBe(4663.5);
    expect(rows.find((r) => r.account.id === 'acc_shared')!.account.shared).toBe(true);
  });

  it('จ่ายบิลแล้วยอดค้างลดลง และจ่ายครบแล้วเหลือศูนย์', () => {
    const txs = [
      swipe('t1', '2026-10-05', 10000, 'acc_own'),
      payBill('p1', '2026-10-25', 4000, 'acc_own'),
    ];
    const partial = creditCardRows(txs, ACCOUNTS, '2026-10')
      .find((r) => r.account.id === 'acc_own')!;
    expect(partial.outstanding).toBe(6000);
    expect(partial.paidThisMonth).toBe(4000);

    const full = creditCardRows([...txs, payBill('p2', '2026-10-26', 6000, 'acc_own')],
      ACCOUNTS, '2026-10').find((r) => r.account.id === 'acc_own')!;
    expect(full.outstanding).toBe(0);
  });

  it('จ่ายบิลไม่ถูกนับเป็นรายจ่ายซ้ำในสรุปเดือน', () => {
    const swiped = [swipe('t1', '2026-10-05', 10000, 'acc_own')];
    const withPay = [...swiped, payBill('p1', '2026-10-25', 10000, 'acc_own')];
    expect(monthSummary(swiped, '2026-10', 0).expense).toBe(10000);
    expect(monthSummary(withPay, '2026-10', 0).expense).toBe(10000);
  });

  it('ยอดค้างยกมาข้ามเดือน ไม่ใช่แค่ยอดที่รูดในเดือนนั้น', () => {
    const txs = [
      swipe('t1', '2026-09-20', 8000, 'acc_own'),
      swipe('t2', '2026-10-03', 2000, 'acc_own'),
    ];
    const oct = creditCardRows(txs, ACCOUNTS, '2026-10')
      .find((r) => r.account.id === 'acc_own')!;
    expect(oct.outstanding).toBe(10000);
    expect(oct.spentThisMonth).toBe(2000);
  });

  it('ยอดตั้งต้นติดลบถือเป็นยอดค้างที่มีอยู่ก่อนเริ่มใช้แอป', () => {
    const opened: Account = { ...OWN, openingBalance: -5000 };
    const rows = creditCardRows([], [BANK, opened], '2026-10');
    expect(rows[0].outstanding).toBe(5000);
  });

  it('วงเงินคงเหลือและสัดส่วนที่ใช้ไปคำนวณถูก', () => {
    const txs = [swipe('t1', '2026-10-05', 12500, 'acc_own')];
    const own = creditCardRows(txs, ACCOUNTS, '2026-10')
      .find((r) => r.account.id === 'acc_own')!;
    expect(own.available).toBe(37500);
    expect(own.usedRatio).toBeCloseTo(0.25, 5);
  });

  it('บัตรที่ไม่ได้ตั้งวงเงิน ไม่มีตัวเลขวงเงินให้ดู ไม่ใช่ศูนย์', () => {
    const shared = creditCardRows([], ACCOUNTS, '2026-10')
      .find((r) => r.account.id === 'acc_shared')!;
    expect(shared.available).toBeUndefined();
    expect(shared.usedRatio).toBeUndefined();
  });

  it('รูดเกินวงเงิน สัดส่วนตันที่ 100% และวงเงินคงเหลือไม่ติดลบ', () => {
    const txs = [swipe('t1', '2026-10-05', 60000, 'acc_own')];
    const own = creditCardRows(txs, ACCOUNTS, '2026-10')
      .find((r) => r.account.id === 'acc_own')!;
    expect(own.usedRatio).toBe(1);
    expect(own.available).toBe(0);
  });

  it('วันครบกำหนดวันที่ 31 ในเดือนที่มี 30 วัน เลื่อนเป็นวันสุดท้าย', () => {
    const shared = creditCardRows([], ACCOUNTS, '2026-11')
      .find((r) => r.account.id === 'acc_shared')!;
    expect(shared.due).toBe('2026-11-30');
  });

  it('นับวันเหลือเฉพาะตอนดูเดือนปัจจุบัน', () => {
    const now = creditCardRows([], ACCOUNTS, '2026-10', '2026-10-20')
      .find((r) => r.account.id === 'acc_own')!;
    expect(now.daysLeft).toBe(5);

    const other = creditCardRows([], ACCOUNTS, '2026-09', '2026-10-20')
      .find((r) => r.account.id === 'acc_own')!;
    expect(other.daysLeft).toBeUndefined();
  });

  it('บัญชีที่ไม่ใช่บัตรเครดิตไม่โผล่ในรายการนี้', () => {
    const rows = creditCardRows([], ACCOUNTS, '2026-10');
    expect(rows.map((r) => r.account.id)).toEqual(['acc_own', 'acc_shared']);
  });

  it('บัตรที่ถูกซ่อนไว้ไม่โผล่', () => {
    const rows = creditCardRows([], [BANK, { ...OWN, archived: true }, SHARED], '2026-10');
    expect(rows.map((r) => r.account.id)).toEqual(['acc_shared']);
  });
});

describe('creditCardAlerts', () => {
  it('เตือนเมื่อใกล้ครบกำหนดและยังมียอดค้าง', () => {
    const txs = [swipe('t1', '2026-10-05', 5000, 'acc_own')];
    const rows = creditCardRows(txs, ACCOUNTS, '2026-10', '2026-10-22');
    expect(creditCardAlerts(rows).map((r) => r.account.id)).toEqual(['acc_own']);
  });

  it('ไม่เตือนถ้าไม่มียอดค้าง แม้จะถึงกำหนดแล้ว', () => {
    const rows = creditCardRows([], ACCOUNTS, '2026-10', '2026-10-25');
    expect(creditCardAlerts(rows)).toEqual([]);
  });

  it('ยังเตือนต่อเมื่อเลยกำหนดมาแล้วและยังค้างอยู่', () => {
    const txs = [swipe('t1', '2026-10-05', 5000, 'acc_own')];
    const rows = creditCardRows(txs, ACCOUNTS, '2026-10', '2026-10-28');
    const alerts = creditCardAlerts(rows);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysLeft).toBe(-3);
  });

  it('ยังไม่เตือนถ้ายังอีกไกล', () => {
    const txs = [swipe('t1', '2026-10-05', 5000, 'acc_own')];
    const rows = creditCardRows(txs, ACCOUNTS, '2026-10', '2026-10-10');
    expect(creditCardAlerts(rows)).toEqual([]);
  });
});
