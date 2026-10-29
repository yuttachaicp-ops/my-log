/** รายการประจำของเดือนที่เลือกซึ่งยังไม่ได้บันทึก
 *  กดทีเดียวบันทึกทั้งหมด หรือเลือกเฉพาะบางรายการก็ได้ */

import { useEffect, useState } from 'react';
import type { Account, Category, RecurringItem } from '../types';
import { dueDateOf } from '../lib/calc';
import { formatDateTH } from '../lib/date';
import { formatTHB, round2 } from '../lib/money';

interface Props {
  items: RecurringItem[];
  categories: Category[];
  accounts: Account[];
  month: string;
  /** วันนี้ตามเวลาไทย ใช้บอกว่าเลยกำหนดหรือยัง (ใช้เฉพาะเดือนปัจจุบัน) */
  today: string;
  onPost: (ids: string[]) => Promise<boolean>;
}

export function RecurringPending({ items, categories, accounts, month, today, onPost }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // เปลี่ยนเดือนแล้วรายการชุดใหม่ ต้องเลือกใหม่ทั้งหมด
  useEffect(() => setPicked(items.map((i) => i.id)), [month, items]);

  if (!items.length) {
    return (
      <div className="state" style={{ padding: '18px 0' }}>
        บันทึกรายการประจำของเดือนนี้ครบแล้ว ✓
      </div>
    );
  }

  const isThisMonth = month === today.slice(0, 7);
  const todayDay = Number(today.slice(8, 10));
  const total = round2(
    items.filter((i) => picked.includes(i.id))
      .reduce((a, i) => a + (i.type === 'expense' ? i.amount : -i.amount), 0),
  );

  const nameOf = (id: string, list: { id: string; name: string; icon: string }[]) =>
    list.find((x) => x.id === id);

  return (
    <div>
      {items.map((r) => {
        const due = dueDateOf(month, r.dueDay);
        const diff = Number(due.slice(8, 10)) - todayDay;
        const cat = nameOf(r.categoryId, categories);
        const acc = r.accountId ? nameOf(r.accountId, accounts) : undefined;
        const on = picked.includes(r.id);
        return (
          <div className="item" key={r.id}>
            <button
              type="button"
              className={`chk ${on ? 'on' : ''}`}
              aria-pressed={on}
              aria-label={`เลือก ${r.name}`}
              onClick={() =>
                setPicked((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))
              }
            >
              {on ? '✓' : ''}
            </button>
            <div className="tx">
              <div className="nm">
                <span className="t">{cat?.icon} {r.name}</span>
                {isThisMonth && diff < 0 && <span className="badge late">เลยกำหนด</span>}
                {isThisMonth && diff >= 0 && diff <= 3 && (
                  <span className="badge due">{diff === 0 ? 'วันนี้' : `อีก ${diff} วัน`}</span>
                )}
              </div>
              <div className="sb">
                ครบกำหนด {formatDateTH(due)}
                {acc ? ` · ${acc.icon} ${acc.name}` : ''}
              </div>
            </div>
            <div className={`am ${r.type === 'expense' ? 'out' : 'in'}`}>
              {r.type === 'expense' ? '−' : '+'}{formatTHB(r.amount)}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          เลือกไว้ {picked.length} รายการ รวม <strong style={{ color: 'var(--text)' }}>{formatTHB(Math.abs(total))}</strong>
        </span>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          disabled={!picked.length || busy}
          onClick={async () => {
            setBusy(true);
            await onPost(picked);
            setBusy(false);
          }}
        >
          {busy ? 'กำลังบันทึก…' : `บันทึกลงเดือนนี้ (${picked.length})`}
        </button>
      </div>
    </div>
  );
}
