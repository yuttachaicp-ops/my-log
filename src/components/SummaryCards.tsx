import type { MonthSummary } from '../types';
import { formatPercent, formatTHB } from '../lib/money';

interface Props {
  summary: MonthSummary;
  incomeChange: number | null;
  expenseChange: number | null;
}

function Trend({ ratio, invert }: { ratio: number | null; invert?: boolean }) {
  if (ratio === null) {
    return <span className="trend flat">— <span className="vs">ไม่มีข้อมูลเดือนก่อน</span></span>;
  }
  const up = ratio > 0;
  // รายจ่ายที่เพิ่มขึ้นคือข่าวไม่ดี จึงสลับสีด้วย invert
  const good = invert ? !up : up;
  return (
    <span className={`trend ${good ? '' : 'down'}`}>
      {up ? '↗' : '↘'} {up ? '+' : ''}{formatPercent(ratio)}
      <span className="vs">จากเดือนก่อน</span>
    </span>
  );
}

export function SummaryCards({ summary, incomeChange, expenseChange }: Props) {
  return (
    <section className="summary-grid" aria-label="สรุปยอดของเดือนนี้">
      <article className="card balance-card">
        <div className="card-label">ยอดคงเหลือ <span aria-hidden="true">✦</span></div>
        <div className="amount">{formatTHB(summary.closingBalance)}</div>
        <div className="card-note">ยอดยกมา + รายรับ − รายจ่าย สะสมถึงสิ้นเดือนนี้</div>
      </article>

      <article className="card">
        <div className="card-label"><span className="dot" aria-hidden="true" /> รายรับทั้งหมด</div>
        <div className="amount">{formatTHB(summary.income)}</div>
        <Trend ratio={incomeChange} />
      </article>

      <article className="card">
        <div className="card-label"><span className="dot coral" aria-hidden="true" /> รายจ่ายทั้งหมด</div>
        <div className="amount">{formatTHB(summary.expense)}</div>
        <Trend ratio={expenseChange} invert />
      </article>
    </section>
  );
}
