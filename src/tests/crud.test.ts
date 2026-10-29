/** เทสต์ CRUD ของ LocalDataSource รวมถึงการแยกข้อมูลจริงกับข้อมูลตัวอย่าง */

import { beforeEach, describe, expect, it } from 'vitest';
import { LocalDataSource } from '../data/localSource';

/** localStorage จำลอง เพราะเทสต์รันใน node ไม่มี DOM */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

const store = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = store;

const base = {
  type: 'expense' as const,
  name: 'ข้าวเที่ยง',
  amount: 60,
  categoryId: 'cat_food',
  date: '2026-10-28',
  source: 'ui' as const,
};

describe('LocalDataSource — CRUD', () => {
  let src: LocalDataSource;

  beforeEach(() => {
    store.clear();
    src = new LocalDataSource('real');
  });

  it('เริ่มต้นว่างเปล่า ไม่มีข้อมูลตัวอย่างปนมา', async () => {
    const d = await src.load();
    expect(d.transactions).toHaveLength(0);
    expect(d.categories.length).toBeGreaterThan(0);
    expect(d.settings.openingBalance).toBe(0);
  });

  it('เพิ่มรายการแล้วอ่านกลับมาได้ พร้อม id และเวลาที่สร้าง', async () => {
    const t = await src.createTransaction(base);
    expect(t.id).toBeTruthy();
    expect(t.createdAt).toBeTruthy();
    const d = await src.load();
    expect(d.transactions).toHaveLength(1);
    expect(d.transactions[0].amount).toBe(60);
  });

  it('ข้อมูลยังอยู่เมื่อสร้างอินสแตนซ์ใหม่ (จำลองการ reload หน้า)', async () => {
    await src.createTransaction(base);
    const again = new LocalDataSource('real');
    const d = await again.load();
    expect(d.transactions).toHaveLength(1);
  });

  it('แก้ไขรายการแล้วยอดเปลี่ยนตาม และ updatedAt ขยับ', async () => {
    const t = await src.createTransaction(base);
    const after = await src.updateTransaction(t.id, { amount: 95.5, name: 'ข้าวเย็น' });
    expect(after.amount).toBe(95.5);
    expect(after.name).toBe('ข้าวเย็น');
    const d = await src.load();
    expect(d.transactions[0].amount).toBe(95.5);
  });

  it('ลบรายการแล้วหายจริง', async () => {
    const t = await src.createTransaction(base);
    await src.deleteTransaction(t.id);
    const d = await src.load();
    expect(d.transactions).toHaveLength(0);
  });

  it('ลบรายการที่ไม่มีอยู่ต้องแจ้ง error ภาษาไทย', async () => {
    await expect(src.deleteTransaction('ไม่มีจริง')).rejects.toThrow('ไม่พบรายการที่ต้องการลบ');
  });
});

describe('LocalDataSource — validation', () => {
  let src: LocalDataSource;
  beforeEach(() => { store.clear(); src = new LocalDataSource('real'); });

  it('ไม่รับจำนวนเงิน 0 หรือติดลบ', async () => {
    await expect(src.createTransaction({ ...base, amount: 0 })).rejects.toThrow('มากกว่า 0');
    await expect(src.createTransaction({ ...base, amount: -5 })).rejects.toThrow('มากกว่า 0');
  });

  it('ไม่รับชื่อรายการว่าง', async () => {
    await expect(src.createTransaction({ ...base, name: '   ' })).rejects.toThrow('ชื่อรายการ');
  });

  it('ไม่รับวันที่ที่ไม่มีอยู่จริง', async () => {
    await expect(src.createTransaction({ ...base, date: '2026-02-30' })).rejects.toThrow('วันที่');
  });

  it('รายการที่ไม่ผ่าน validation ต้องไม่ถูกบันทึก', async () => {
    await expect(src.createTransaction({ ...base, amount: -1 })).rejects.toThrow();
    const d = await src.load();
    expect(d.transactions).toHaveLength(0);
  });
});

describe('การแยกข้อมูลจริงออกจากข้อมูลตัวอย่าง', () => {
  beforeEach(() => store.clear());

  it('เขียนฝั่งจริงไม่กระทบฝั่งตัวอย่าง และกลับกัน', async () => {
    const real = new LocalDataSource('real');
    const sample = new LocalDataSource('sample');

    await real.createTransaction(base);
    const sampleData = await sample.load();
    const realData = await real.load();

    expect(realData.transactions).toHaveLength(1);
    expect(realData.transactions.every((t) => t.source !== 'sample')).toBe(true);
    expect(sampleData.transactions.length).toBeGreaterThan(0);
    expect(sampleData.transactions.every((t) => t.source === 'sample')).toBe(true);
  });

  it('ลบรายการฝั่งตัวอย่างไม่ทำให้ข้อมูลจริงหาย', async () => {
    const real = new LocalDataSource('real');
    const sample = new LocalDataSource('sample');
    await real.createTransaction(base);
    const s = await sample.load();
    await sample.deleteTransaction(s.transactions[0].id);
    expect((await real.load()).transactions).toHaveLength(1);
  });
});

describe('หมวดหมู่และเป้าหมาย', () => {
  let src: LocalDataSource;
  beforeEach(() => { store.clear(); src = new LocalDataSource('real'); });

  it('หมวดที่ยังมีรายการใช้อยู่จะถูกซ่อนแทนการลบ เพื่อไม่ให้รายการเดิมเสีย', async () => {
    await src.createTransaction(base);
    await src.deleteCategory('cat_food');
    const d = await src.load();
    const cat = d.categories.find((c) => c.id === 'cat_food');
    expect(cat?.archived).toBe(true);
    expect(d.transactions[0].categoryId).toBe('cat_food');
  });

  it('หมวดที่ไม่มีใครใช้ลบออกได้จริง', async () => {
    const before = (await src.load()).categories.length;
    await src.deleteCategory('cat_pet');
    const d = await src.load();
    expect(d.categories).toHaveLength(before - 1);
  });

  it('บันทึกและลบเป้าหมายเงินออมได้', async () => {
    const g = await src.saveGoal({ id: '', name: 'กล้อง', targetAmount: 25000, savedAmount: 1000 });
    expect(g.id).toBeTruthy();
    expect((await src.load()).goals).toHaveLength(1);
    await src.deleteGoal(g.id);
    expect((await src.load()).goals).toHaveLength(0);
  });

  it('ไม่รับเป้าหมายที่ยอดเป็นศูนย์', async () => {
    await expect(
      src.saveGoal({ id: '', name: 'x', targetAmount: 0, savedAmount: 0 }),
    ).rejects.toThrow('มากกว่า 0');
  });

  it('ตั้งยอดยกมาแล้วค่าถูกเก็บไว้', async () => {
    await src.setOpeningBalance(12345.678);
    expect((await src.load()).settings.openingBalance).toBe(12345.68);
  });
});
