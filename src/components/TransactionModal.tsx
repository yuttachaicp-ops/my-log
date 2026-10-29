/** ฟอร์มเพิ่ม/แก้ไขรายการ ใช้ตัวเดียวกันทั้งรายรับ รายจ่าย และการโอนระหว่างบัญชี */

import { useMemo, useState } from 'react';
import type { Account, Category, Transaction, TxType } from '../types';
import { Modal } from './ui/Modal';
import { parseAmount } from '../lib/money';
import { isValidDateISO, todayISO } from '../lib/date';

export interface TxFormValues {
  type: TxType;
  name: string;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  date: string;
  note: string;
}

interface Props {
  categories: Category[];
  accounts: Account[];
  /** ถ้าส่งมาคือโหมดแก้ไข */
  editing?: Transaction | null;
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (values: TxFormValues) => Promise<boolean>;
}

export function TransactionModal({
  categories, accounts, editing, defaultDate, onClose, onSubmit,
}: Props) {
  const open = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);

  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const [accountId, setAccountId] = useState(editing?.accountId ?? open[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(
    editing?.toAccountId ?? open.find((a) => a.id !== (editing?.accountId ?? open[0]?.id))?.id ?? '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const catOptions = useMemo(
    () => (type === 'transfer' ? [] : categories.filter((c) => c.type === type && !c.archived)),
    [categories, type],
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const effectiveCategory =
    type === 'transfer'
      ? ''
      : catOptions.some((c) => c.id === categoryId)
        ? categoryId
        : catOptions[0]?.id ?? '';

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'กรุณาใส่ชื่อรายการ';
    const amt = parseAmount(amount);
    if (amt === null) e.amount = 'จำนวนเงินต้องเป็นตัวเลข';
    else if (amt <= 0) e.amount = 'จำนวนเงินต้องมากกว่า 0';
    if (!isValidDateISO(date)) e.date = 'วันที่ไม่ถูกต้อง';
    if (!accountId) e.accountId = 'กรุณาเลือกบัญชี';
    if (type === 'transfer') {
      if (!toAccountId) e.toAccountId = 'กรุณาเลือกบัญชีปลายทาง';
      else if (toAccountId === accountId) e.toAccountId = 'ต้องเป็นคนละบัญชีกับต้นทาง';
    } else if (!effectiveCategory) {
      e.categoryId = 'กรุณาเลือกหมวดหมู่';
    }
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
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      date,
      note: note.trim(),
    });
    setSaving(false);
    if (ok) onClose();
  }

  const TYPES: { key: TxType; label: string; cls: string }[] = [
    { key: 'expense', label: 'รายจ่าย', cls: 'expense' },
    { key: 'income', label: 'รายรับ', cls: 'income' },
    { key: 'transfer', label: 'โอนย้าย', cls: 'transfer' },
  ];

  return (
    <Modal title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div
          className="type-toggle"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
          role="group"
          aria-label="ประเภทรายการ"
        >
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={t.cls}
              aria-pressed={type === t.key}
              onClick={() => { setType(t.key); setCategoryId(''); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {type === 'transfer' && (
          <div className="hint-box">
            การโอนคือการย้ายเงินระหว่างบัญชีของคุณเอง ไม่ถูกนับเป็นรายรับหรือรายจ่าย
            ยอดสรุปของเดือนจึงไม่เปลี่ยน
          </div>
        )}

        <label className="field">
          <span>ชื่อรายการ</span>
          <input
            className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={type === 'transfer' ? 'เช่น กดเงินสดจากธนาคาร' : 'เช่น ข้าวเที่ยง'}
            autoComplete="off" aria-invalid={!!errors.name}
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
            <span>{type === 'transfer' ? 'จากบัญชี' : 'บัญชี'}</span>
            <select
              className="input" value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-invalid={!!errors.accountId}
            >
              {open.map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
            {errors.accountId && <span className="field-error">{errors.accountId}</span>}
          </label>

          {type === 'transfer' ? (
            <label className="field">
              <span>ไปบัญชี</span>
              <select
                className="input" value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                aria-invalid={!!errors.toAccountId}
              >
                <option value="">— เลือกบัญชี —</option>
                {open.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
              {errors.toAccountId && <span className="field-error">{errors.toAccountId}</span>}
            </label>
          ) : (
            <label className="field">
              <span>หมวดหมู่</span>
              <select
                className="input" value={effectiveCategory}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-invalid={!!errors.categoryId}
              >
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
            </label>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>วันที่</span>
            <input
              className="input" type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </label>
          <label className="field">
            <span>หมายเหตุ (ไม่บังคับ)</span>
            <input
              className="input" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม" autoComplete="off"
            />
          </label>
        </div>

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
