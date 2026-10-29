/** กราฟแท่งเทียบรายรับกับรายจ่าย สลับดูรายสัปดาห์หรือรายเดือนได้
 *  แท่งรายจ่ายใส่ลายเฉียงไว้ จะได้แยกออกจากรายรับแม้พิมพ์ขาวดำหรือตาบอดสี */

import { useId, useState } from 'react';
import { formatCompactTHB, formatTHB, round2 } from '../lib/money';
import { Empty } from './ui/States';

export interface BarPoint {
  key: string;
  label: string;
  full: string;
  income: number;
  expense: number;
}

const W = 760;
const H = 250;
const PAD = { top: 18, right: 14, bottom: 34, left: 58 };

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function ComparisonChart({ data }: { data: BarPoint[] }) {
  const patId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const hasAny = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasAny) {
    return <Empty icon="📊" text="ยังไม่มีรายการให้เปรียบเทียบในช่วงนี้" />;
  }

  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.income, d.expense))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(26, slot * 0.3);
  const gap = 5;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  const hv = hover !== null ? data[hover] : null;

  return (
    <figure style={{ margin: 0 }}>
      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กราฟแท่งเทียบรายรับกับรายจ่าย">
          <defs>
            <pattern
              id={patId} width="6" height="6" patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--c-expense)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--surface)" strokeWidth="2" opacity="0.5" />
            </pattern>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                stroke="var(--grid)" strokeWidth="1"
              />
              <text
                x={PAD.left - 10} y={y(t) + 4} textAnchor="end"
                fontSize="11" fill="var(--muted)"
              >
                {formatCompactTHB(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const xIn = cx - barW - gap / 2;
            const xOut = cx + gap / 2;
            const base = y(0);
            const on = hover === i;
            return (
              <g
                key={d.key}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                role="group"
                aria-label={`${d.full} รายรับ ${formatTHB(d.income)} รายจ่าย ${formatTHB(d.expense)}`}
                style={{ cursor: 'default' }}
              >
                <rect
                  x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH}
                  fill={on ? 'var(--surface-2)' : 'transparent'}
                />
                <rect
                  x={xIn} y={y(d.income)} width={barW} height={Math.max(0, base - y(d.income))}
                  rx="5" fill="var(--c-income)"
                />
                <rect
                  x={xOut} y={y(d.expense)} width={barW} height={Math.max(0, base - y(d.expense))}
                  rx="5" fill={`url(#${patId})`}
                />
                <text
                  x={cx} y={H - 11} textAnchor="middle" fontSize="11" fill="var(--muted)"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hv && (
          <div
            className="chart-tip"
            style={{
              left: `${((PAD.left + slot * (hover as number) + slot / 2) / W) * 100}%`,
              top: `calc(${(Math.min(y(hv.income), y(hv.expense)) / H) * 100}% - 12px)`,
            }}
          >
            <div className="t-date">{hv.full}</div>
            <div className="t-row">
              <span className="sw" style={{ background: 'var(--c-income)' }} />
              รายรับ <span className="v">{formatTHB(hv.income)}</span>
            </div>
            <div className="t-row">
              <span className="sw" style={{ background: 'var(--c-expense)' }} />
              รายจ่าย <span className="v">{formatTHB(hv.expense)}</span>
            </div>
            <div className="t-row">
              <span className="sw" style={{ background: 'transparent' }} />
              ต่าง <span className="v">{formatTHB(round2(hv.income - hv.expense))}</span>
            </div>
          </div>
        )}
      </div>

      <div className="chart-foot">
        <span>
          รายรับรวม{' '}
          <strong style={{ color: 'var(--c-income)' }}>
            {formatTHB(round2(data.reduce((a, d) => a + d.income, 0)))}
          </strong>
        </span>
        <span>
          รายจ่ายรวม{' '}
          <strong style={{ color: 'var(--c-expense)' }}>
            {formatTHB(round2(data.reduce((a, d) => a + d.expense, 0)))}
          </strong>
        </span>
        <span>แท่งทึบคือรายรับ แท่งลายเฉียงคือรายจ่าย</span>
      </div>
    </figure>
  );
}
