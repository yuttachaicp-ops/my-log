/** การ์ดสรุปบัตรเครดิต — ยอดค้าง วงเงินคงเหลือ วันครบกำหนด และปุ่มจ่ายบิล
 *
 *  บัตรใช้ร่วมกันจะมีป้ายกำกับให้เห็นชัด แต่ตัวเลขยังเป็นยอดเต็มตามที่รูดจริง
 *  แอปไม่เดาส่วนแบ่งให้ เพราะสัดส่วนจริงเปลี่ยนทุกเดือน เดาผิดแล้วงบเพี้ยนทั้งเดือน */

import { useState } from 'react';
import type { Account } from '../types';
import type { CreditCardRow as Row } from '../lib/calc';
import { formatTHB, parseAmount } from '../lib/money';
import { formatDateTH } from '../lib/date';
import { Empty } from './ui/States';
import { Modal } from './ui/Modal';

interface Props {
  rows: Row[];
  /** บัญชีที่ใช้จ่ายบิลได้ (เงินสด ธนาคาร วอลเล็ต) */
  payFrom: Account[];
  today: string;
  onPay(cardId: string, fromId: string, amount: number, date: string): Promise<boolean>;
}

function dueLabel(r: Row): { text: string; tone: 'late' | 'soon' | 'ok' } | null {
  if (!r.due) return null;
  const d = formatDateTH(r.due);
  if (r.daysLeft === undefined) return { text: `ครบกำหนด ${d}`, tone: 'ok' };
  if (r.daysLeft < 0) return { text: `เลยกำหนดมา ${-r.daysLeft} วัน`, tone: 'late' };
  if (r.daysLeft === 0) return { text: 'ครบกำหนดวันนี้', tone: 'late' };
  if (r.daysLeft <= 5) return { text: `อีก ${r.daysLeft} วัน (${d})`, tone: 'soon' };
  return { text: `ครบกำหนด ${d}`, tone: 'ok' };
}

export function CreditCards({ rows, payFrom, today, onPay }: Props) {
  const [paying, setPaying] = useState<Row | null>(null);

  if (!rows.length) {
    return (
      <Empty
        icon="💳"
        text="ยังไม่มีบัตรเครดิต"
        hint="เพิ่มได้ที่หน้าตั้งค่า เลือกประเภทเป็นบัตรเครดิต"
      />
    );
  }

  return (
    <>
      <ul className="card-list">
        {rows.map((r) => {
          const due = dueLabel(r);
          const owes = r.outstanding > 0;
          return (
            <li key={r.account.id} className="credit-row">
              <div className="credit-head">
                <span className="acc-ic" style={{ background: r.account.color + '22' }} aria-hidden="true">
                  {r.account.icon}
                </span>
                <span className="nm">
                  <span className="t">{r.account.name}</span>
                  <span className={`badge ${r.account.shared ? 'shared' : 'own'}`}>
                    {r.account.shared ? 'ใช้ร่วมกัน' : 'ส่วนตัว'}
                  </span>
                </span>
                <span className="spacer" />
                <span className={`am ${owes ? 'amount-out' : ''}`}>{formatTHB(r.outstanding)}</span>
              </div>

              <div className="credit-meta">
                <span>รูดเดือนนี้ {formatTHB(r.spentThisMonth)}</span>
                {r.paidThisMonth > 0 && <span>จ่ายแล้ว {formatTHB(r.paidThisMonth)}</span>}
                {due && <span className={`due-tag ${due.tone}`}>{due.text}</span>}
              </div>

              {r.usedRatio !== undefined && (
                <div className="credit-limit">
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(r.usedRatio * 100)}%` }} />
                  </div>
                  <span>
                    ใช้ไป {Math.round(r.usedRatio * 100)}% · เหลือใช้ได้ {formatTHB(r.available ?? 0)}
                  </span>
                </div>
              )}

              {owes && payFrom.length > 0 && (
                <button className="link-btn" onClick={() => setPaying(r)}>
                  บันทึกการจ่ายบิล ↗
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {paying && (
        <PayDialog
          row={paying}
          payFrom={payFrom}
          today={today}
          onClose={() => setPaying(null)}
          onPay={onPay}
        />
      )}
    </>
  );
}

function PayDialog({
  row, payFrom, today, onClose, onPay,
}: {
  row: Row;
  payFrom: Account[];
  today: string;
  onClose: () => void;
  onPay: Props['onPay'];
}) {
  const [from, setFrom] = useState(payFrom[0]?.id ?? '');
  const [amount, setAmount] = useState(String(row.outstanding));
  const [date, setDate] = useState(today);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseAmount(amount);
    if (!from) { setErr('เลือกบัญชีที่จ่ายจาก'); return; }
    if (v === null || v <= 0) { setErr('จำนวนเงินต้องมากกว่า 0'); return; }
    if (v > row.outstanding) { setErr(`จ่ายเกินยอดค้าง (${formatTHB(row.outstanding)})`); return; }
    setBusy(true);
    const ok = await onPay(row.account.id, from, v, date);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={`จ่ายบิล ${row.account.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="hint-box">
          ยอดค้างตอนนี้ <strong>{formatTHB(row.outstanding)}</strong> —
          บันทึกแล้วจะเป็นการโอนเงินจากบัญชีที่เลือกไปตัดยอดบัตร
          ไม่ถูกนับเป็นรายจ่ายซ้ำ เพราะตอนรูดนับไปแล้วครั้งหนึ่ง
        </div>
        <label className="field">
          <span>จ่ายจากบัญชี</span>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {payFrom.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>จำนวนเงิน</span>
            <input className="input" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field">
            <span>วันที่จ่าย</span>
            <input className="input" type="date" value={date}
              onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" className="btn btn-ghost"
            onClick={() => setAmount(String(row.outstanding))}>
            จ่ายเต็มจำนวน
          </button>
        </div>
        {err && <div className="field-error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>บันทึกการจ่าย</button>
        </div>
      </form>
    </Modal>
  );
}


