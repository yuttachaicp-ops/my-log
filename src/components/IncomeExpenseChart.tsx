/** กราฟเส้นรายรับเทียบรายจ่าย วาดด้วย SVG เอง
 *
 *  ที่เพิ่มจากเดิม: เส้นโค้งแบบ Catmull-Rom, จุดข้อมูล, tooltip ตามเมาส์และนิ้ว,
 *  เลือกช่วงเวลาได้ และสีทั้งหมดอ่านจาก CSS variable จึงเปลี่ยนตามธีมเอง
 */

import { useId, useMemo, useRef, useState } from 'react';
import { formatCompactTHB, formatTHB, round2 } from '../lib/money';
import { Empty } from './ui/States';

export interface SeriesPoint {
  key: string;
  label: string;
  /** ข้อความเต็มใน tooltip เช่น "28 ต.ค. 2569" */
  full: string;
  income: number;
  expense: number;
}

const W = 760;
const H = 250;
const PAD = { top: 18, right: 14, bottom: 30, left: 58 };

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/** เส้นโค้งผ่านทุกจุดแบบ Catmull-Rom แปลงเป็น cubic bezier
 *  tension ต่ำ ๆ ทำให้โค้งนุ่มแต่ไม่แกว่งเกินจริงจนอ่านค่าผิด */
function smoothPath(pts: [number, number][], tension = 0.22): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');

  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function IncomeExpenseChart({
  data,
  emptyHint,
}: {
  data: SeriesPoint[];
  emptyHint?: string;
}) {
  const gradId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const hasAny = data.some((d) => d.income > 0 || d.expense > 0);

  const geo = useMemo(() => {
    const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.income, d.expense))));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    return {
      max, x, y,
      income: data.map((d, i) => [x(i), y(d.income)] as [number, number]),
      expense: data.map((d, i) => [x(i), y(d.expense)] as [number, number]),
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * max),
    };
  }, [data]);

  if (!hasAny) {
    return (
      <Empty
        icon="📈"
        text="ยังไม่มีรายการในช่วงนี้"
        hint={emptyHint || 'เพิ่มรายการแรกแล้วกราฟจะขึ้นให้เอง'}
      />
    );
  }

  const totalIn = round2(data.reduce((a, d) => a + d.income, 0));
  const totalOut = round2(data.reduce((a, d) => a + d.expense, 0));
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  /** หาจุดที่ใกล้ตำแหน่งนิ้ว/เมาส์ที่สุด ใช้ได้ทั้ง mouse และ touch */
  function pick(clientX: number) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const ratio = (clientX - box.left) / box.width;
    const vx = ratio * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(geo.x(i) - vx);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  }

  // เปลี่ยนช่วงเวลาแล้วจำนวนจุดเปลี่ยน ดัชนีที่ค้างไว้อาจเกินขอบ ต้องกันไว้
  const hi = hover !== null && hover < data.length ? hover : null;
  const hv = hi !== null ? data[hi] : null;
  const tipLeftPct = hi !== null ? (geo.x(hi) / W) * 100 : 0;
  const tipTopPx =
    hv !== null ? (Math.min(geo.y(hv.income), geo.y(hv.expense)) / H) * 100 : 0;

  return (
    <figure style={{ margin: 0 }}>
      <div
        className="chart-wrap"
        ref={wrapRef}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`กราฟรายรับรายจ่าย รายรับรวม ${formatTHB(totalIn)} รายจ่ายรวม ${formatTHB(totalOut)}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-income)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--c-income)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {geo.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)}
                stroke="var(--grid)" strokeWidth="1"
              />
              <text
                x={PAD.left - 10} y={geo.y(t) + 4} textAnchor="end"
                fontSize="11" fill="var(--muted)"
              >
                {formatCompactTHB(t)}
              </text>
            </g>
          ))}

          <path
            d={`${smoothPath(geo.income)} L${geo.x(data.length - 1)},${geo.y(0)} L${geo.x(0)},${geo.y(0)} Z`}
            fill={`url(#${gradId})`}
          />
          <path
            d={smoothPath(geo.income)} fill="none" stroke="var(--c-income)"
            strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
          />
          {/* รายจ่ายใช้เส้นประ เพื่อให้แยกออกแม้มองไม่เห็นสี */}
          <path
            d={smoothPath(geo.expense)} fill="none" stroke="var(--c-expense)"
            strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray="7 5"
          />

          {hi !== null && (
            <line
              x1={geo.x(hi)} x2={geo.x(hi)} y1={PAD.top} y2={H - PAD.bottom}
              stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
            />
          )}

          {data.map((d, i) => (
            <g key={d.key}>
              <circle
                cx={geo.x(i)} cy={geo.y(d.income)} r={hi === i ? 5.5 : 3.2}
                fill="var(--surface)" stroke="var(--c-income)" strokeWidth="2.2"
              />
              <circle
                cx={geo.x(i)} cy={geo.y(d.expense)} r={hi === i ? 5.5 : 3.2}
                fill="var(--surface)" stroke="var(--c-expense)" strokeWidth="2.2"
              />
            </g>
          ))}

          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text
                key={d.key} x={geo.x(i)} y={H - 9} textAnchor="middle"
                fontSize="11" fill="var(--muted)"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>

        {hv && (
          <div
            className="chart-tip"
            style={{ left: `${tipLeftPct}%`, top: `calc(${tipTopPx}% - 12px)` }}
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
              คงเหลือ <span className="v">{formatTHB(round2(hv.income - hv.expense))}</span>
            </div>
          </div>
        )}
      </div>

      {/* ตัวเลขกำกับ เพื่อให้อ่านกราฟได้โดยไม่ต้องพึ่งสีอย่างเดียว */}
      <div className="chart-foot">
        <span>รายรับรวม <strong style={{ color: 'var(--c-income)' }}>{formatTHB(totalIn)}</strong></span>
        <span>รายจ่ายรวม <strong style={{ color: 'var(--c-expense)' }}>{formatTHB(totalOut)}</strong></span>
        <span>คงเหลือ <strong>{formatTHB(round2(totalIn - totalOut))}</strong></span>
      </div>

      <figcaption className="sr-only">
        เส้นทึบคือรายรับ เส้นประคือรายจ่าย รายรับรวมในช่วงนี้ {formatTHB(totalIn)}{' '}
        รายจ่ายรวม {formatTHB(totalOut)}
      </figcaption>
    </figure>
  );
}
