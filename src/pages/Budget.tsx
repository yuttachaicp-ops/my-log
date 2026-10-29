import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { budgetRows, dueDateOf } from '../lib/calc';
import { formatTHB, parseAmount } from '../lib/money';
import { BudgetProgress } from '../components/BudgetProgress';
import { SavingsGoalList } from '../components/SavingsGoal';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { formatDateTH } from '../lib/date';
import type { RecurringItem, SavingsGoal } from '../types';

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

function RecurringForm({
  initial, categories, accounts, onClose, onSave,
}: {
  initial: RecurringItem | null;
  categories: { id: string; name: string; icon: string; type: 'income' | 'expense'; archived?: boolean }[];
  accounts: { id: string; name: string; icon: string; archived?: boolean }[];
  onClose: () => void;
  onSave: (r: RecurringItem) => Promise<boolean>;
}) {
  const [type, setType] = useState<'income' | 'expense'>(initial?.type ?? 'expense');
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [dueDay, setDueDay] = useState(initial ? String(initial.dueDay) : '1');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const cats = categories.filter((c) => c.type === type && !c.archived);
  const accs = accounts.filter((a) => !a.archived);
  const cat = cats.some((c) => c.id === categoryId) ? categoryId : cats[0]?.id ?? '';
  const acc = accs.some((a) => a.id === accountId) ? accountId : accs[0]?.id ?? '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseAmount(amount);
    const day = Number(dueDay);
    if (!name.trim()) { setErr('กรุณาใส่ชื่อรายการ'); return; }
    if (amt === null || amt <= 0) { setErr('จำนวนเงินต้องมากกว่า 0'); return; }
    if (!isFinite(day) || day < 1 || day > 31) { setErr('วันครบกำหนดต้องอยู่ระหว่าง 1 ถึง 31'); return; }
    if (!cat) { setErr('กรุณาเลือกหมวดหมู่'); return; }
    setBusy(true);
    const ok = await onSave({
      id: initial?.id ?? '',
      name: name.trim(), type, amount: amt, dueDay: day,
      categoryId: cat, accountId: acc, note: note.trim(),
      active: initial?.active ?? true,
      createdAt: initial?.createdAt ?? '', updatedAt: '',
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={initial ? 'แก้ไขรายการประจำ' : 'เพิ่มรายการประจำ'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="type-toggle" role="group" aria-label="ประเภท">
          <button type="button" className="expense" aria-pressed={type === 'expense'}
            onClick={() => setType('expense')}>รายจ่าย</button>
          <button type="button" className="income" aria-pressed={type === 'income'}
            onClick={() => setType('income')}>รายรับ</button>
        </div>

        <label className="field">
          <span>ชื่อรายการ</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ค่าเช่าห้อง" />
        </label>

        <div className="field-row">
          <label className="field">
            <span>จำนวนเงินต่อเดือน</span>
            <input className="input" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </label>
          <label className="field">
            <span>ครบกำหนดวันที่</span>
            <input className="input" type="number" min={1} max={31} value={dueDay}
              onChange={(e) => setDueDay(e.target.value)} />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>หมวดหมู่</span>
            <select className="input" value={cat} onChange={(e) => setCategoryId(e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>ตัดจากบัญชี</span>
            <select className="input" value={acc} onChange={(e) => setAccountId(e.target.value)}>
              {accs.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span>หมายเหตุ (ไม่บังคับ)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="hint-box">
          ตั้งไว้แล้วทุกเดือนแอปจะเตือนให้กดบันทึก ไม่ได้บันทึกให้เองอัตโนมัติ
          เพราะยอดจริงอาจไม่ตรงกับที่ตั้งไว้ เช่นยอดบัตรเครดิต
        </div>

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
  const { data, month, saveGoal, removeGoal, saveRecurring, removeRecurring } = useStore();
  const d = data!;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [recEditing, setRecEditing] = useState<RecurringItem | null>(null);
  const [recDelete, setRecDelete] = useState<RecurringItem | null>(null);

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
            <div className="card-title">รายการประจำทุกเดือน</div>
            <div className="card-subtitle">
              ตั้งไว้ครั้งเดียว ขึ้นเดือนใหม่กดยืนยันที่หน้าภาพรวมได้เลย
            </div>
          </div>
          <div className="spacer" />
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setRecEditing(null); setRecOpen(true); }}>
            ＋ เพิ่มรายการประจำ
          </button>
        </div>

        {d.recurring.length === 0 ? (
          <div className="state">
            <span className="big" aria-hidden="true">🔁</span>
            ยังไม่มีรายการประจำ
            <div style={{ marginTop: 6, fontSize: 13 }}>
              เช่น ค่าเช่า ค่าเน็ต ยอดบัตรเครดิต ที่ต้องจ่ายทุกเดือน
            </div>
          </div>
        ) : (
          <div>
            {d.recurring.map((r) => {
              const cat = d.categories.find((c) => c.id === r.categoryId);
              const acc = d.accounts.find((a) => a.id === r.accountId);
              return (
                <div className="item" key={r.id}>
                  <button
                    type="button"
                    className={`chk ${r.active ? 'on' : ''}`}
                    aria-pressed={r.active}
                    aria-label={r.active ? `ปิดใช้ ${r.name}` : `เปิดใช้ ${r.name}`}
                    onClick={() => saveRecurring({ ...r, active: !r.active })}
                  >
                    {r.active ? '✓' : ''}
                  </button>
                  <div className="tx">
                    <div className="nm">
                      <span className="t">{cat?.icon} {r.name}</span>
                      {!r.active && <span className="badge">ปิดใช้อยู่</span>}
                    </div>
                    <div className="sb">
                      ทุกวันที่ {r.dueDay} · เดือนนี้ตรงกับ {formatDateTH(dueDateOf(month, r.dueDay))}
                      {acc ? ` · ${acc.icon} ${acc.name}` : ''}
                    </div>
                  </div>
                  <div className={`am ${r.type === 'expense' ? 'out' : 'in'}`}>
                    {r.type === 'expense' ? '−' : '+'}{formatTHB(r.amount)}
                  </div>
                  <button className="icon-btn" aria-label={`แก้ไข ${r.name}`}
                    onClick={() => { setRecEditing(r); setRecOpen(true); }}>✎</button>
                  <button className="icon-btn danger" aria-label={`ลบ ${r.name}`}
                    onClick={() => setRecDelete(r)}>🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

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

      {recOpen && (
        <RecurringForm
          initial={recEditing}
          categories={d.categories}
          accounts={d.accounts}
          onClose={() => setRecOpen(false)}
          onSave={saveRecurring}
        />
      )}

      {recDelete && (
        <ConfirmDialog
          title="ลบรายการประจำนี้?"
          message={`“${recDelete.name}” จะไม่ถูกเตือนอีก รายการที่เคยบันทึกไปแล้วยังอยู่ครบ`}
          onConfirm={async () => { await removeRecurring(recDelete.id); setRecDelete(null); }}
          onCancel={() => setRecDelete(null)}
        />
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
