/** รายงานสรุปรายเดือนแบบพร้อมพิมพ์
 *
 *  ตั้งใจไม่ใช้ไลบรารีสร้าง PDF เพราะทุกเบราว์เซอร์มี "พิมพ์ → บันทึกเป็น PDF" อยู่แล้ว
 *  วิธีนี้ได้ไฟล์ที่เลือกขนาดกระดาษเองได้ ข้อความยังเป็นตัวอักษรจริง ค้นหาได้ ไม่ใช่รูป
 *  และไม่ต้องเพิ่ม dependency สักตัว
 */

import type {
  AccountBalance, CategoryTotal, MonthSummary, Transaction, Category,
} from '../types';
import type { BudgetRow } from '../lib/calc';
import { formatDateTH, formatMonthTH } from '../lib/date';
import { formatPercent, formatTHB } from '../lib/money';

interface Props {
  month: string;
  summary: MonthSummary;
  categories: Category[];
  catTotals: CategoryTotal[];
  budgets: BudgetRow[];
  balances: AccountBalance[];
  transactions: Transaction[];
  onClose: () => void;
}

export function MonthlyReport({
  month, summary, categories, catTotals, budgets, balances, transactions, onClose,
}: Props) {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="report-overlay">
      <div className="report-bar no-print">
        <strong>รายงานประจำเดือน{formatMonthTH(month)}</strong>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          กดพิมพ์แล้วเลือกปลายทางเป็น "บันทึกเป็น PDF" เพื่อเก็บเป็นไฟล์
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>ปิด</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            พิมพ์ / บันทึกเป็น PDF
          </button>
        </div>
      </div>

      <div className="report-sheet" id="monthly-report">
        <header className="report-head">
          <div>
            <h1>My Log — รายงานการเงิน</h1>
            <p>ประจำเดือน{formatMonthTH(month)}</p>
          </div>
          <div className="report-balance">
            <span>ยอดคงเหลือสิ้นเดือน</span>
            <strong>{formatTHB(summary.closingBalance)}</strong>
          </div>
        </header>

        <section className="report-kpis">
          <div><span>รายรับ</span><strong>{formatTHB(summary.income)}</strong></div>
          <div><span>รายจ่าย</span><strong>{formatTHB(summary.expense)}</strong></div>
          <div><span>คงเหลือสุทธิ</span><strong>{formatTHB(summary.net)}</strong></div>
          <div>
            <span>สัดส่วนที่ใช้ไป</span>
            <strong>{summary.income === 0 ? '—' : formatPercent(summary.expense / summary.income)}</strong>
          </div>
        </section>

        <section>
          <h2>ยอดคงเหลือแต่ละบัญชี</h2>
          <table className="report-table">
            <thead><tr><th>บัญชี</th><th className="num">ยอดคงเหลือ</th></tr></thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.accountId}>
                  <td>{b.name}</td>
                  <td className="num">{formatTHB(b.balance)}</td>
                </tr>
              ))}
              {!balances.length && <tr><td colSpan={2}>ไม่มีบัญชี</td></tr>}
            </tbody>
          </table>
        </section>

        <section>
          <h2>รายจ่ายตามหมวดหมู่</h2>
          <table className="report-table">
            <thead>
              <tr><th>หมวดหมู่</th><th className="num">จำนวนเงิน</th><th className="num">สัดส่วน</th></tr>
            </thead>
            <tbody>
              {catTotals.map((c) => (
                <tr key={c.categoryId}>
                  <td>{c.name}</td>
                  <td className="num">{formatTHB(c.amount)}</td>
                  <td className="num">{formatPercent(c.share)}</td>
                </tr>
              ))}
              {!catTotals.length && <tr><td colSpan={3}>ไม่มีรายจ่ายในเดือนนี้</td></tr>}
            </tbody>
            {catTotals.length > 0 && (
              <tfoot>
                <tr><th>รวม</th><th className="num">{formatTHB(summary.expense)}</th><th className="num">100.0%</th></tr>
              </tfoot>
            )}
          </table>
        </section>

        {budgets.length > 0 && (
          <section>
            <h2>งบประมาณ</h2>
            <table className="report-table">
              <thead>
                <tr><th>หมวดหมู่</th><th className="num">ใช้ไป</th><th className="num">งบ</th><th className="num">คงเหลือ</th></tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.categoryId}>
                    <td>{b.name}{b.status === 'over' ? ' (เกินงบ)' : ''}</td>
                    <td className="num">{formatTHB(b.amount)}</td>
                    <td className="num">{formatTHB(b.monthlyBudget)}</td>
                    <td className="num">{formatTHB(b.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>รายการทั้งหมด ({transactions.length} รายการ)</h2>
          <table className="report-table">
            <thead>
              <tr><th>วันที่</th><th>รายการ</th><th>หมวดหมู่</th><th className="num">จำนวนเงิน</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTH(t.date)}</td>
                  <td>{t.name}</td>
                  <td>{t.type === 'transfer' ? 'โอนย้าย' : catName(t.categoryId)}</td>
                  <td className="num">
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↔'}
                    {formatTHB(t.amount)}
                  </td>
                </tr>
              ))}
              {!transactions.length && <tr><td colSpan={4}>ไม่มีรายการ</td></tr>}
            </tbody>
          </table>
        </section>

        <footer className="report-foot">
          สร้างจากแอป My Log · ข้อมูลเฉพาะเดือน{formatMonthTH(month)} ·
          การโอนระหว่างบัญชีไม่ถูกนับเป็นรายรับหรือรายจ่าย
        </footer>
      </div>
    </div>
  );
}
