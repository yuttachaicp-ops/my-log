/** ตรรกะนำเข้าไฟล์ JSON ที่ทั้งโหมดในเครื่องและโหมดคลาวด์ใช้ร่วมกัน
 *
 *  เขียนขึ้นหลังพบว่าปุ่มนำเข้าใช้ไม่ได้ในโหมดคลาวด์และเงียบไปเฉย ๆ
 *  ชุดนี้จึงเน้นสองเรื่อง: ผลลัพธ์ถูกต้อง และของเดิมไม่หายเมื่อไฟล์มีแถวเสีย */

import { describe, expect, it } from 'vitest';
import { buildImportedDataset, isPortableSource } from '../data/portable';
import type { Dataset, Transaction } from '../types';

const ts = '2026-01-01T00:00:00.000Z';

function tx(id: string, amount: number, date = '2026-10-31'): Transaction {
  return {
    id, date, type: 'expense', name: 'รายการ ' + id, categoryId: 'cat_home',
    amount, accountId: 'acc_bank', source: 'import', createdAt: ts, updatedAt: ts,
  };
}

function current(): Dataset {
  return {
    transactions: [tx('old_1', 100)],
    categories: [{ id: 'cat_home', name: 'ที่พักและบิล', type: 'expense', icon: '🏠', color: '#4E735F' }],
    accounts: [{ id: 'acc_bank', name: 'บัญชีธนาคาร', kind: 'bank', icon: '🏦', color: '#2E75B6', openingBalance: 0 }],
    recurring: [],
    goals: [],
    settings: { openingBalance: 0, currency: 'THB', timezone: 'Asia/Bangkok' },
  };
}

/** ตัวตรวจอย่างง่าย เลียนแบบกติกาจริง: ต้องมีชื่อ และยอดต้องมากกว่า 0 */
function validate(t: Transaction) {
  if (!t.name) throw new Error('ยังไม่ได้ใส่ชื่อรายการ');
  if (!(t.amount > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
}

describe('buildImportedDataset', () => {
  it('โหมด replace ใช้ชุดใหม่แทนของเดิมทั้งหมด', () => {
    const file = JSON.stringify({ transactions: [tx('new_1', 50), tx('new_2', 70)] });
    const { next, added } = buildImportedDataset(file, current(), 'replace', validate);
    expect(added).toBe(2);
    expect(next.transactions.map((t) => t.id)).toEqual(['new_1', 'new_2']);
  });

  it('โหมด merge เก็บของเดิมไว้ และไม่เติมรายการที่ id ซ้ำ', () => {
    const file = JSON.stringify({ transactions: [tx('old_1', 999), tx('new_1', 50)] });
    const { next } = buildImportedDataset(file, current(), 'merge', validate);
    expect(next.transactions.map((t) => t.id)).toEqual(['old_1', 'new_1']);
    // แถวที่ id ซ้ำต้องไม่ทับของเดิม ยอดเดิม 100 ต้องอยู่ครบ
    expect(next.transactions[0].amount).toBe(100);
  });

  it('ไฟล์ที่มีแถวเสียแม้แถวเดียว ต้องโยน error และไม่คืนชุดข้อมูลออกมาเลย', () => {
    const file = JSON.stringify({ transactions: [tx('ok', 50), { ...tx('bad', 0) }] });
    expect(() => buildImportedDataset(file, current(), 'replace', validate))
      .toThrowError(/ลำดับที่ 2/);
  });

  it('บอกได้ว่าแถวไหนผิด ไม่ใช่แค่บอกว่าไฟล์ใช้ไม่ได้', () => {
    const file = JSON.stringify({ transactions: [{ ...tx('bad', 0), name: '' }] });
    expect(() => buildImportedDataset(file, current(), 'replace', validate))
      .toThrowError(/ยังไม่ได้ใส่ชื่อรายการ/);
  });

  it('รายการที่ไม่ได้ระบุบัญชี ผูกกับบัญชีแรกที่มีอยู่ให้เอง', () => {
    const noAcc = { ...tx('n', 20) } as Partial<Transaction>;
    delete noAcc.accountId;
    const file = JSON.stringify({ transactions: [noAcc] });
    const { next } = buildImportedDataset(file, current(), 'replace', validate);
    expect(next.transactions[0].accountId).toBe('acc_bank');
  });

  it('ไฟล์ที่ไม่มี categories ให้คงหมวดเดิมไว้ ไม่ล้างทิ้ง', () => {
    const file = JSON.stringify({ transactions: [tx('n', 20)] });
    const { next } = buildImportedDataset(file, current(), 'replace', validate);
    expect(next.categories.map((c) => c.id)).toEqual(['cat_home']);
  });

  it('ยอดเงินถูกปัดเป็นทศนิยม 2 ตำแหน่ง', () => {
    const file = JSON.stringify({ transactions: [tx('n', 17841.7849)] });
    const { next } = buildImportedDataset(file, current(), 'replace', validate);
    expect(next.transactions[0].amount).toBe(17841.78);
  });

  it('ไฟล์ที่ไม่ใช่ JSON และไฟล์ที่ไม่มี transactions ถูกปฏิเสธคนละข้อความ', () => {
    expect(() => buildImportedDataset('ไม่ใช่ json', current(), 'replace', validate))
      .toThrowError(/ไม่ใช่ JSON/);
    expect(() => buildImportedDataset('{"goals":[]}', current(), 'replace', validate))
      .toThrowError(/transactions/);
  });

  it('ข้อมูลจริงเดือนตุลาคม 8 รายการ รวมได้ 37,683.67', () => {
    const real = [
      17841.78, 4663.5, 1395.93, 426.93, 6075.53, 1565, 3415, 2300,
    ].map((amt, i) => tx('oct_' + i, amt));
    const file = JSON.stringify({ transactions: real });
    const { next, added } = buildImportedDataset(file, current(), 'replace', validate);
    expect(added).toBe(8);
    const total = next.transactions.reduce((a, t) => a + t.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(37683.67);
  });
});

describe('isPortableSource', () => {
  it('ยอมรับเฉพาะตัวที่มีครบทั้ง exportJSON และ importJSON', () => {
    expect(isPortableSource({ exportJSON: () => {}, importJSON: () => {} })).toBe(true);
    expect(isPortableSource({ exportJSON: () => {} })).toBe(false);
    expect(isPortableSource({})).toBe(false);
    expect(isPortableSource(null)).toBe(false);
    expect(isPortableSource(undefined)).toBe(false);
  });
});

/** การถดถอยที่เกิดขึ้นจริง: หน้าตั้งค่าเคยเช็ก `source instanceof LocalDataSource`
 *  โหมดคลาวด์จึงกดนำเข้าแล้วเงียบ ชุดนี้กันไม่ให้พลาดซ้ำ */
describe('ทุกแหล่งข้อมูลต้องนำเข้า/ส่งออกได้', () => {
  it('LocalDataSource ทั้งโหมดจริงและโหมดตัวอย่าง', async () => {
    const { LocalDataSource } = await import('../data/localSource');
    expect(isPortableSource(new LocalDataSource('real'))).toBe(true);
    expect(isPortableSource(new LocalDataSource('sample'))).toBe(true);
  });

  it('SupabaseDataSource ก็ต้องได้เหมือนกัน', async () => {
    const { SupabaseDataSource } = await import('../data/supabaseSource');
    const s = new SupabaseDataSource({ url: 'https://x.supabase.co', anonKey: 'k'.repeat(40) });
    expect(isPortableSource(s)).toBe(true);
  });
});
