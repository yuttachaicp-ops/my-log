import { useState } from 'react';
import { useStore } from '../state/store';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { parseAmount, formatTHB } from '../lib/money';
import type { Category } from '../types';

type CatType = 'income' | 'expense';

const PALETTE = ['#4E735F', '#D87965', '#E7C77D', '#7FA8A0', '#B98FA6', '#C8A27A', '#A8ADA4'];

function CategoryForm({
  initial, onClose, onSave,
}: {
  initial: Partial<Category> | null;
  onClose: () => void;
  onSave: (c: Category) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<CatType>(initial?.type ?? 'expense');
  const [icon, setIcon] = useState(initial?.icon ?? '🏷️');
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [budget, setBudget] = useState(
    initial?.monthlyBudget ? String(initial.monthlyBudget) : '',
  );
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('กรุณาใส่ชื่อหมวดหมู่'); return; }
    const b = budget.trim() === '' ? undefined : parseAmount(budget);
    if (budget.trim() !== '' && (b === null || b === undefined || b < 0)) {
      setErr('งบประมาณต้องเป็นตัวเลขไม่ติดลบ'); return;
    }
    setSaving(true);
    const ok = await onSave({
      id: initial?.id ?? '',
      name: name.trim(), type, icon: icon || '•', color,
      monthlyBudget: type === 'expense' ? (b ?? undefined) : undefined,
      archived: initial?.archived,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal title={initial?.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="type-toggle" role="group" aria-label="ประเภทหมวดหมู่">
          <button
            type="button" className="expense" aria-pressed={type === 'expense'}
            onClick={() => setType('expense')}
          >
            รายจ่าย
          </button>
          <button
            type="button" className="income" aria-pressed={type === 'income'}
            onClick={() => setType('income')}
          >
            รายรับ
          </button>
        </div>

        <div className="field-row">
          <label className="field">
            <span>ชื่อหมวดหมู่</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>ไอคอน (อิโมจิ)</span>
            <input
              className="input" value={icon} maxLength={4}
              onChange={(e) => setIcon(e.target.value)}
            />
          </label>
        </div>

        <div className="field">
          <span>สี</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PALETTE.map((c) => (
              <button
                key={c} type="button" onClick={() => setColor(c)}
                aria-label={`เลือกสี ${c}`} aria-pressed={color === c}
                style={{
                  width: 30, height: 30, borderRadius: 9, background: c,
                  border: color === c ? '3px solid var(--text)' : '1px solid var(--border)',
                }}
              />
            ))}
          </div>
        </div>

        {type === 'expense' && (
          <label className="field">
            <span>งบต่อเดือน (บาท, เว้นว่างได้)</span>
            <input
              className="input" value={budget} inputMode="decimal"
              onChange={(e) => setBudget(e.target.value)} placeholder="เช่น 4000"
            />
          </label>
        )}

        {err && <div className="field-error">{err}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}

export function Categories() {
  const { data, saveCategory, removeCategory } = useStore();
  const d = data!;
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const groups: { title: string; type: CatType }[] = [
    { title: 'หมวดรายจ่าย', type: 'expense' },
    { title: 'หมวดรายรับ', type: 'income' },
  ];

  async function confirmDelete() {
    if (!pendingDelete) return;
    await removeCategory(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <>
      <section className="welcome">
        <div>
          <h2>หมวดหมู่ของคุณ</h2>
          <p>จัดกลุ่มรายการให้ดูง่าย และตั้งงบรายหมวดได้ที่นี่</p>
        </div>
        <div className="welcome-actions">
          <button
            className="btn btn-primary"
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            ＋ เพิ่มหมวดหมู่
          </button>
        </div>
      </section>

      {groups.map((g) => {
        const list = d.categories.filter((c) => c.type === g.type && !c.archived);
        return (
          <section className="card" key={g.type} style={{ marginBottom: 'var(--gap)' }}>
            <div className="card-head">
              <div>
                <div className="card-title">{g.title}</div>
                <div className="card-subtitle">{list.length} หมวด</div>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="state">ยังไม่มีหมวดในกลุ่มนี้</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">หมวดหมู่</th>
                      <th scope="col">งบต่อเดือน</th>
                      <th scope="col"><span className="sr-only">จัดการ</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="tx-name">
                            <span
                              className="tx-icon"
                              style={{ background: c.color + '22' }}
                              aria-hidden="true"
                            >
                              {c.icon}
                            </span>
                            <div className="tx-text"><div className="tx-title">{c.name}</div></div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--muted)' }}>
                          {c.monthlyBudget ? formatTHB(c.monthlyBudget) : '— ไม่ได้ตั้ง'}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              onClick={() => { setEditing(c); setOpen(true); }}
                              aria-label={`แก้ไขหมวด ${c.name}`}
                            >
                              ✎
                            </button>
                            <button
                              className="icon-btn danger"
                              onClick={() => setPendingDelete(c)}
                              aria-label={`ลบหมวด ${c.name}`}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {open && (
        <CategoryForm
          initial={editing}
          onClose={() => setOpen(false)}
          onSave={saveCategory}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="ลบหมวดหมู่นี้?"
          message={
            `ถ้ามีรายการใช้หมวด “${pendingDelete.name}” อยู่ ระบบจะซ่อนหมวดนี้แทนการลบ ` +
            'เพื่อไม่ให้รายการเดิมเสียข้อมูล'
          }
          confirmText="ลบหมวดหมู่"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
