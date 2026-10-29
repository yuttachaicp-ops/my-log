import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import {
  budgetRows, categoryTotals, changeRatio, dailySeries, monthlySeries,
  monthSummary, weeklySeries,
} from '../lib/calc';
import {
  formatDateTH, formatDayShortTH, formatMonthShortTH, formatMonthTH, monthOf, shiftMonth,
} from '../lib/date';
import { SummaryCards } from '../components/SummaryCards';
import { IncomeExpenseChart, type SeriesPoint } from '../components/IncomeExpenseChart';
import { ComparisonChart, type BarPoint } from '../components/ComparisonChart';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { TransactionTable } from '../components/TransactionTable';
import { BudgetProgress } from '../components/BudgetProgress';
import { SavingsGoalList } from '../components/SavingsGoal';
import type { PageKey } from './pages';
import type { Transaction } from '../types';

interface Props {
  onAdd: () => void;
  onNavigate: (p: PageKey) => void;
  onEditTx: (t: Transaction) => void;
}

/** ช่วงเวลาของกราฟเส้น — "เดือนนี้" ดูรายวัน ที่เหลือดูรายเดือน */
type Range = 'month' | '3m' | '6m' | '12m';
const RANGES: { key: Range; label: string; months: number }[] = [
  { key: 'month', label: 'เดือนนี้', months: 1 },
  { key: '3m', label: '3 เดือน', months: 3 },
  { key: '6m', label: '6 เดือน', months: 6 },
  { key: '12m', label: '12 เดือน', months: 12 },
];

type BarView = 'week' | 'month';

export function Dashboard({ onAdd, onNavigate, onEditTx }: Props) {
  const { data, month, setFilter } = useStore();
  const d = data!;
  const [range, setRange] = useState<Range>('month');
  const [barView, setBarView] = useState<BarView>('week');

  const view = useMemo(() => {
    const opening = d.settings.openingBalance;
    const summary = monthSummary(d.transactions, month, opening);
    const prev = monthSummary(d.transactions, shiftMonth(month, -1), opening);
    const inMonth = d.transactions.filter((t) => monthOf(t.date) === month);
    const recent = [...inMonth].sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    );

    // --- กราฟเส้นตามช่วงที่เลือก
    const cfg = RANGES.find((r) => r.key === range)!;
    const line: SeriesPoint[] =
      range === 'month'
        ? dailySeries(d.transactions, month).map((p) => ({
            key: p.date,
            label: formatDayShortTH(p.date),
            full: formatDateTH(p.date),
            income: p.income,
            expense: p.expense,
          }))
        : monthlySeries(d.transactions, month, cfg.months).map((p) => ({
            key: p.key,
            label: formatMonthShortTH(p.key),
            full: formatMonthTH(p.key),
            income: p.income,
            expense: p.expense,
          }));

    // --- หมวดหมู่ ใช้ช่วงเดียวกับกราฟเส้น ตัวเลขจึงสอดคล้องกัน
    const firstMonth = range === 'month' ? month : shiftMonth(month, -(cfg.months - 1));
    const inRange = d.transactions.filter((t) => {
      const m = monthOf(t.date);
      return m >= firstMonth && m <= month;
    });
    const cats = categoryTotals(inRange, d.categories, 'expense');
    const rangeExpense = cats.reduce((a, c) => a + c.amount, 0);

    // --- กราฟแท่ง
    const bars: BarPoint[] =
      barView === 'week'
        ? weeklySeries(d.transactions, month).map((w) => ({
            key: w.key,
            label: w.label,
            full: `วันที่ ${w.label} ${formatMonthTH(month)}`,
            income: w.income,
            expense: w.expense,
          }))
        : monthlySeries(d.transactions, month, 6).map((m) => ({
            key: m.key,
            label: formatMonthShortTH(m.key),
            full: formatMonthTH(m.key),
            income: m.income,
            expense: m.expense,
          }));

    return {
      summary,
      incomeChange: changeRatio(summary.income, prev.income),
      expenseChange: changeRatio(summary.expense, prev.expense),
      line, cats, rangeExpense, bars, recent,
      rangeLabel: range === 'month' ? formatMonthTH(month) : `${cfg.months} เดือนล่าสุด`,
      budgets: budgetRows(inMonth, d.categories),
    };
  }, [d, month, range, barView]);

  /** กดหมวดจากกราฟ แล้วเด้งไปหน้ารายการพร้อมกรองหมวดนั้นไว้ให้ */
  function pickCategory(categoryId: string) {
    setFilter({ categoryId, type: 'expense', search: '' });
    onNavigate('transactions');
  }

  return (
    <>
      <section className="welcome">
        <div>
          <h2>สวัสดี วันนี้เป็นยังไงบ้าง ☀️</h2>
          <p>มาดูภาพรวมการเงินของคุณกัน</p>
        </div>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={onAdd}>＋ เพิ่มรายการ</button>
        </div>
      </section>

      <SummaryCards
        summary={view.summary}
        incomeChange={view.incomeChange}
        expenseChange={view.expenseChange}
      />

      <section className="content-grid">
        <article className="card">
          <div className="card-head">
            <div>
              <div className="card-title">ภาพรวมรายรับ–รายจ่าย</div>
              <div className="card-subtitle">{view.rangeLabel}</div>
            </div>
            <div className="spacer" />
            <div className="chart-toolbar" role="group" aria-label="เลือกช่วงเวลาของกราฟ">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={range === r.key}
                  onClick={() => setRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-legend" style={{ marginBottom: 8 }}>
            <span className="legend-item"><i className="dot" /> รายรับ (เส้นทึบ)</span>
            <span className="legend-item"><i className="dot coral" /> รายจ่าย (เส้นประ)</span>
          </div>
          <IncomeExpenseChart data={view.line} />
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <div className="card-title">รายจ่ายตามหมวดหมู่</div>
              <div className="card-subtitle">{view.rangeLabel}</div>
            </div>
            <div className="spacer" />
            <button className="link-btn" onClick={() => onNavigate('categories')}>
              จัดการหมวด ↗
            </button>
          </div>
          <CategoryBreakdown
            rows={view.cats}
            total={view.rangeExpense}
            onPickCategory={pickCategory}
          />
        </article>
      </section>

      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">เทียบรายรับกับรายจ่าย</div>
            <div className="card-subtitle">
              {barView === 'week' ? `แยกรายสัปดาห์ของ${formatMonthTH(month)}` : '6 เดือนล่าสุด'}
            </div>
          </div>
          <div className="spacer" />
          <div className="chart-toolbar" role="group" aria-label="เลือกมุมมองกราฟแท่ง">
            <button type="button" aria-pressed={barView === 'week'} onClick={() => setBarView('week')}>
              รายสัปดาห์
            </button>
            <button type="button" aria-pressed={barView === 'month'} onClick={() => setBarView('month')}>
              รายเดือน
            </button>
          </div>
        </div>
        <ComparisonChart data={view.bars} />
      </section>

      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">รายการล่าสุด</div>
            <div className="card-subtitle">บันทึกใหม่ ๆ ของคุณ</div>
          </div>
          <div className="spacer" />
          <button className="link-btn" onClick={() => onNavigate('transactions')}>
            ดูรายการทั้งหมด ↗
          </button>
        </div>
        <TransactionTable
          rows={view.recent}
          categories={d.categories}
          onEdit={onEditTx}
          limit={6}
          emptyText="ยังไม่มีรายการในเดือนนี้"
        />
      </section>

      <section className="bottom-grid">
        <article className="card">
          <div className="card-head">
            <div>
              <div className="card-title">งบประมาณรายเดือน</div>
              <div className="card-subtitle">คุมค่าใช้จ่ายแบบไม่กดดันตัวเอง</div>
            </div>
            <div className="spacer" />
            <button className="link-btn" onClick={() => onNavigate('budget')}>จัดการ ↗</button>
          </div>
          <BudgetProgress rows={view.budgets} limit={4} />
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <div className="card-title">เป้าหมายของฉัน</div>
              <div className="card-subtitle">ทุกก้าวเล็ก ๆ มีความหมาย</div>
            </div>
            <div className="spacer" />
            <button className="link-btn" onClick={() => onNavigate('budget')}>ดูเป้าหมาย ↗</button>
          </div>
          <SavingsGoalList goals={d.goals.slice(0, 2)} />
        </article>
      </section>
    </>
  );
}
