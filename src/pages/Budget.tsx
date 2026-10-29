import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { budgetRows } from '../lib/calc';
import { formatTHB, parseAmount } from '../lib/money';
import { BudgetProgress } from '../components/BudgetProgress';
import { SavingsGoalList } from '../components/SavingsGoal';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import type { SavingsGoal } from '../types';

function GoalForm({
  initial, onClose, onSave,
}: {
  initial: SavingsGoal | null;
  onClose: () => void;
  onSave: (g: SavingsGoal) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : '');
  const [saved, setSaved] = useState(initial ? String(initial.savedAmount) : '0');
  const [due, setDue] = useState(initial?.dueDate ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = parseAmount(target);
    const s = parseAmount(saved);
    if (!name.trim()) { setErr('กรุณาใส่ชื่อเป้าหมาย'); return; }
    if (t === null || t <= 0) { setErr('ยอดเป้าหมายต้องมากกว่า 0'); return; }
    if (s === null || s < 0) { setErr('ยอดที่เก็บแล้วต้องไม่ติดลบ'); return; }
    setBusy(true);
    const ok = await onSave({
      id: initial?.id ?? '',
      name: name.trim(), targetAmount: t, savedAmount: s,
      dueDate: due || undefined,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={initial ? 'แก้ไขเป้าหมาย' : 'เพิ่มเป้าหมายเงินออม'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>ชื่อเป้าหมาย</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น เงินสำรองฉุกเฉิน" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>ยอดเป้าหมาย (บาท)</span>
            <input className="input" inputMode="decimal" value={target}
              onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="field">
            <span>เก็บแล้ว (บาท)</span>
            <input className="input" inputMode="decimal" value={saved}
              onChange={(e) => setSaved(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>กำหนดเสร็จ (ไม่บังคับ)</span>
          <input className="input" type="date" value={due}
            onChange={(e) => setDue(e.target.value)} />
        </label>
        {err && <div className="field-error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}

export function Budget() {
  const { data, month, saveGoal, removeGoal } = useStore();
  const d = data!;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);

  const rows = useMemo(() => {
    const inMonth = d.transactions.filter((t) => t.date.slice(0, 7) === month);
    return budgetRows(inMonth, d.categories);
  }, [d, month]);

  const totalBudget = rows.reduce((a, r) => a + r.monthlyBudget, 0);
  const totalUsed = rows.reduce((a, r) => a + r.amount, 0);

  async function confirmDelete() {
    if (!pendingDelete) return;
    await removeGoal(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">งบประมาณเดือนนี้</div>
            <div className="card-subtitle">
              ใช้ไป {formatTHB(totalUsed)} จากงบรวม {formatTHB(totalBudget)}
            </div>
          </div>
        </div>
        <BudgetProgress rows={rows} />
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">เป้าหมายเงินออม</div>
            <div className="card-subtitle">ทุกก้าวเล็ก ๆ มีความหมาย</div>
          </div>
          <div className="spacer" />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            ＋ เพิ่มเป้าหมาย
          </button>
        </div>
        <SavingsGoalList
          goals={d.goals}
          onEdit={(g) => { setEditing(g); setOpen(true); }}
          onDelete={setPendingDelete}
        />
      </section>

      {open && (
        <GoalForm initial={editing} onClose={() => setOpen(false)} onSave={saveGoal} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="ลบเป้าหมายนี้?"
          message={`“${pendingDelete.name}” จะถูกลบถาวร การลบนี้ย้อนกลับไม่ได้`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
