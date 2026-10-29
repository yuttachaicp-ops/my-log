/** ฟอร์มเพิ่ม/แก้ไขรายการ ใช้ตัวเดียวกันทั้งสองกรณี */

import { useMemo, useState } from 'react';
import type { Category, Transaction, TxType } from '../types';
import { Modal } from './ui/Modal';
import { parseAmount } from '../lib/money';
import { isValidDateISO, todayISO } from '../lib/date';

interface Props {
  categories: Category[];
  /** ถ้าส่งมาคือโหมดแก้ไข */
  editing?: Transaction | null;
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (values: {
    type: TxType; name: string; amount: number;
    categoryId: string; date: string; note: string;
  }) => Promise<boolean>;
}

export function TransactionModal({
  categories, editing, defaultDate, onClose, onSubmit,
}: Props) {
  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => categories.filter((c) => c.type === type && !c.archived),
    [categories, type],
  );
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? options[0]?.id ?? '',
  );

  // เปลี่ยนประเภทแล้วหมวดเดิมอาจไม่อยู่ในรายการ ต้องเด้งกลับตัวแรก
  const effectiveCategory = options.some((c) => c.id === categoryId)
    ? categoryId
    : options[0]?.id ?? '';

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'กรุณาใส่ชื่อรายการ';
    const amt = parseAmount(amount);
    if (amt === null) e.amount = 'จำนวนเงินต้องเป็นตัวเลข';
    else if (amt <= 0) e.amount = 'จำนวนเงินต้องมากกว่า 0';
    if (!isValidDateISO(date)) e.date = 'วันที่ไม่ถูกต้อง';
    if (!effectiveCategory) e.categoryId = 'กรุณาเลือกหมวดหมู่';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const ok = await onSubmit({
      type,
      name: name.trim(),
      amount: parseAmount(amount) as number,
      categoryId: effectiveCategory,
      date,
      note: note.trim(),
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="type-toggle" role="group" aria-label="ประเภทรายการ">
          <button
            type="button" className="expense"
            aria-pressed={type === 'expense'}
            onClick={() => { setType('expense'); setCategoryId(''); }}
          >
            รายจ่าย
          </button>
          <button
            type="button" className="income"
            aria-pressed={type === 'income'}
            onClick={() => { setType('income'); setCategoryId(''); }}
          >
            รายรับ
          </button>
        </div>

        <label className="field">
          <span>ชื่อรายการ</span>
          <input
            className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ข้าวเที่ยง" autoComplete="off"
            aria-invalid={!!errors.name}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label className="field">
          <span>จำนวนเงิน (บาท)</span>
          <input
            className="input" value={amount} onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal" placeholder="0.00" aria-invalid={!!errors.amount}
          />
          {errors.amount && <span className="field-error">{errors.amount}</span>}
        </label>

        <div className="field-row">
          <label className="field">
            <span>หมวดหมู่</span>
            <select
              className="input" value={effectiveCategory}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-invalid={!!errors.categoryId}
            >
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
          </label>

          <label className="field">
            <span>วันที่</span>
            <input
              className="input" type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </label>
        </div>

        <label className="field">
          <span>หมายเหตุ (ไม่บังคับ)</span>
          <input
            className="input" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="รายละเอียดเพิ่มเติม" autoComplete="off"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกรายการ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
