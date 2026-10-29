/** โดนัทสัดส่วนรายจ่ายตามหมวด
 *  กดชิ้นส่วนหรือกดแถวในรายการ เพื่อไปดูรายการของหมวดนั้น
 *  สีอ่านจาก CSS variable --cat-1..8 จึงเปลี่ยนตามธีมเอง */

import { useState } from 'react';
import type { CategoryTotal } from '../types';
import { formatPercent, formatTHB } from '../lib/money';
import { Empty } from './ui/States';

const SIZE = 190;
const R = 72;
const STROKE = 28;
const C = 2 * Math.PI * R;
const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--cat-${i + 1})`);

interface Props {
  rows: CategoryTotal[];
  total: number;
  /** กดหมวดแล้วไปดูรายการของหมวดนั้น */
  onPickCategory?: (categoryId: string) => void;
}

export function CategoryBreakdown({ rows, total, onPickCategory }: Props) {
  const [active, setActive] = useState<string | null>(null);

  if (!rows.length) {
    return <Empty icon="🍃" text="ยังไม่มีรายจ่ายในช่วงนี้" />;
  }

  let offset = 0;
  const arcs = rows.map((r, i) => {
    const len = r.share * C;
    const arc = { ...r, len, offset, fill: PALETTE[i % PALETTE.length] };
    offset += len;
    return arc;
  });

  const shown = active ? rows.find((r) => r.categoryId === active) : null;

  return (
    <div>
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: 10 }}>
        <svg
          width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`สัดส่วนรายจ่ายตามหมวด ยอดรวม ${formatTHB(total)}`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" stroke="var(--surface-2)" strokeWidth={STROKE}
            />
            {arcs.map((a) => (
              <circle
                key={a.categoryId}
                className={`donut-slice${active && active !== a.categoryId ? ' dim' : ''}`}
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                fill="none" stroke={a.fill}
                strokeWidth={active === a.categoryId ? STROKE + 6 : STROKE}
                strokeDasharray={`${a.len} ${C - a.len}`}
                strokeDashoffset={-a.offset}
                onMouseEnter={() => setActive(a.categoryId)}
                onMouseLeave={() => setActive(null)}
                onClick={() => onPickCategory?.(a.categoryId)}
              />
            ))}
          </g>

          <text x={SIZE / 2} y={SIZE / 2 - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {shown ? shown.name : 'รายจ่ายรวม'}
          </text>
          <text
            x={SIZE / 2} y={SIZE / 2 + 12} textAnchor="middle"
            fontSize="16" fontWeight="700" fill="var(--text)"
          >
            {formatTHB(shown ? shown.amount : total)}
          </text>
          {shown && (
            <text x={SIZE / 2} y={SIZE / 2 + 30} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {formatPercent(shown.share)} ของรายจ่าย
            </text>
          )}
        </svg>
      </div>

      <ul className="cat-list">
        {rows.map((r, i) => (
          <li key={r.categoryId}>
            <button
              type="button"
              className={`cat-row${active === r.categoryId ? ' on' : ''}`}
              onMouseEnter={() => setActive(r.categoryId)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(r.categoryId)}
              onBlur={() => setActive(null)}
              onClick={() => onPickCategory?.(r.categoryId)}
              aria-label={`${r.name} ${formatTHB(r.amount)} คิดเป็น ${formatPercent(r.share)} กดเพื่อดูรายการ`}
            >
              <span className="sw" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden="true" />
              <span className="nm">{r.icon} {r.name}</span>
              <span className="pc">{formatPercent(r.share)}</span>
              <span className="am">{formatTHB(r.amount)}</span>
            </button>
          </li>
        ))}
      </ul>

      {onPickCategory && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
          กดที่หมวดเพื่อดูรายการของหมวดนั้น
        </div>
      )}
    </div>
  );
}
