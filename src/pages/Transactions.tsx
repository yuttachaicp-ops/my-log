import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { filterTransactions, totals } from '../lib/calc';
import { formatTHB } from '../lib/money';
import { TransactionTable } from '../components/TransactionTable';
import { ConfirmDialog } from '../components/ui/Modal';
import type { Transaction } from '../types';

const PAGE_SIZE = 20;

export function Transactions({ onEditTx }: { onEditTx: (t: Transaction) => void }) {
  const { data, month, filter, setFilter, removeTransaction } = useStore();
  const d = data!;
  const [page, setPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [allMonths, setAllMonths] = useState(false);

  const rows = useMemo(() => {
    const list = filterTransactions(d.transactions, {
      ...filter,
      month: allMonths ? undefined : month,
    });
    return list.sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    );
  }, [d.transactions, filter, month, allMonths]);

  const sum = useMemo(() => totals(rows), [rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  async function confirmDelete() {
    if (!pendingDelete) return;
    await removeTransaction(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="filters">
          <div className="search-box">
            <span className="ic" aria-hidden="true">🔍</span>
            <label className="sr-only" htmlFor="tx-search">ค้นหารายการ</label>
            <input
              id="tx-search"
              className="input"
              placeholder="ค้นหาชื่อรายการหรือหมายเหตุ"
              value={filter.search || ''}
              onChange={(e) => { setFilter({ search: e.target.value }); setPage(0); }}
            />
          </div>

          <label className="sr-only" htmlFor="tx-type">ประเภท</label>
          <select
            id="tx-type"
            className="input"
            style={{ width: 'auto' }}
            value={filter.type || 'all'}
            onChange={(e) => { setFilter({ type: e.target.value as never }); setPage(0); }}
          >
            <option value="all">ทุกประเภท</option>
            <option value="income">รายรับ</option>
            <option value="expense">รายจ่าย</option>
          </select>

          <label className="sr-only" htmlFor="tx-cat">หมวดหมู่</label>
          <select
            id="tx-cat"
            className="input"
            style={{ width: 'auto' }}
            value={filter.categoryId || 'all'}
            onChange={(e) => { setFilter({ categoryId: e.target.value }); setPage(0); }}
          >
            <option value="all">ทุกหมวดหมู่</option>
            {d.categories.filter((c) => !c.archived).map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>

          <button
            type="button"
            className={`btn btn-sm ${allMonths ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={allMonths}
            onClick={() => { setAllMonths((v) => !v); setPage(0); }}
          >
            {allMonths ? 'ทุกเดือน' : 'เฉพาะเดือนที่เลือก'}
          </button>
        </div>

        <div
          style={{
            display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13.5,
            color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 12,
          }}
        >
          <span>พบ <strong style={{ color: 'var(--text)' }}>{rows.length}</strong> รายการ</span>
          <span>รายรับ <strong className="amount-in">{formatTHB(sum.income)}</strong></span>
          <span>รายจ่าย <strong className="amount-out">{formatTHB(sum.expense)}</strong></span>
          <span>สุทธิ <strong style={{ color: 'var(--text)' }}>{formatTHB(sum.net)}</strong></span>
        </div>
      </section>

      <section className="card">
        <TransactionTable
          rows={slice}
          categories={d.categories}
          onEdit={onEditTx}
          onDelete={setPendingDelete}
          emptyText="ไม่พบรายการที่ตรงกับเงื่อนไข"
        />

        {pageCount > 1 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, marginTop: 16,
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              ‹ ก่อนหน้า
            </button>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              หน้า {safePage + 1} จาก {pageCount}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              ถัดไป ›
            </button>
          </div>
        )}
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title="ลบรายการนี้?"
          message={`“${pendingDelete.name}” จำนวน ${formatTHB(pendingDelete.amount)} จะถูกลบถาวร การลบนี้ย้อนกลับไม่ได้`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
