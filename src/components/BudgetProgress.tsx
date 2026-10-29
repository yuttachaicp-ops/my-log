import type { BudgetRow } from '../lib/calc';
import { formatPercent, formatTHB } from '../lib/money';
import { Empty } from './ui/States';

export function BudgetProgress({ rows, limit }: { rows: BudgetRow[]; limit?: number }) {
  if (!rows.length) {
    return (
      <Empty
        icon="🎯"
        text="ยังไม่ได้ตั้งงบประมาณ"
        hint="ตั้งงบรายหมวดได้ที่หน้าหมวดหมู่"
      />
    );
  }

  const list = limit ? rows.slice(0, limit) : rows;

  return (
    <div>
      {list.map((r) => {
        const width = Math.min(100, r.used * 100);
        return (
          <div className="progress-row" key={r.categoryId}>
            <div className="progress-head">
              <span aria-hidden="true">{r.icon}</span>
              <span className="nm">{r.name}</span>
              <span className="vals">
                {formatTHB(r.amount)} / {formatTHB(r.monthlyBudget)}
              </span>
            </div>
            <div
              className="bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(width)}
              aria-label={`งบ${r.name} ใช้ไป ${formatPercent(r.used)}`}
            >
              <i className={r.status === 'ok' ? '' : r.status} style={{ width: `${width}%` }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 5 }}>
              {r.status === 'over'
                ? `เกินงบ ${formatTHB(Math.abs(r.remaining))}`
                : `เหลืออีก ${formatTHB(r.remaining)} · ใช้ไป ${formatPercent(r.used)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
