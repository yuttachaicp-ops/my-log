import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { TransactionModal } from './components/TransactionModal';
import { Loading, ErrorState } from './components/ui/States';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Categories } from './pages/Categories';
import { Budget } from './pages/Budget';
import { Settings } from './pages/Settings';
import type { PageKey } from './pages/pages';
import { useStore } from './state/store';
import { todayISO } from './lib/date';
import type { Transaction } from './types';

export default function App() {
  const { data, loading, error, reload, month, addTransaction, editTransaction } = useStore();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // ทางลัดบนจอโฮมมือถือ (?action=add) ให้เปิดฟอร์มเพิ่มรายการทันที
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add') {
      setModalOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  function openAdd() { setEditingTx(null); setModalOpen(true); }
  function openEdit(t: Transaction) { setEditingTx(t); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingTx(null); }

  /** วันที่ตั้งต้นในฟอร์ม: ถ้ากำลังดูเดือนอื่นอยู่ ให้ใช้วันที่ 1 ของเดือนนั้น
   *  จะได้ไม่เผลอบันทึกลงเดือนปัจจุบันโดยไม่ตั้งใจ */
  const today = todayISO();
  const defaultDate = month === today.slice(0, 7) ? today : `${month}-01`;

  return (
    <AppShell page={page} onNavigate={setPage} onAdd={openAdd}>
      {loading && <Loading />}
      {!loading && error && <ErrorState text={error} onRetry={() => void reload()} />}

      {!loading && !error && data && (
        <>
          {page === 'dashboard' && (
            <Dashboard onAdd={openAdd} onNavigate={setPage} onEditTx={openEdit} />
          )}
          {page === 'transactions' && <Transactions onEditTx={openEdit} />}
          {page === 'categories' && <Categories />}
          {page === 'budget' && <Budget />}
          {page === 'settings' && <Settings />}
        </>
      )}

      {modalOpen && data && (
        <TransactionModal
          categories={data.categories}
          editing={editingTx}
          defaultDate={defaultDate}
          onClose={closeModal}
          onSubmit={async (v) => {
            if (editingTx) {
              return editTransaction(editingTx.id, {
                type: v.type, name: v.name, amount: v.amount,
                categoryId: v.categoryId, date: v.date, note: v.note,
              });
            }
            return addTransaction({
              type: v.type, name: v.name, amount: v.amount,
              categoryId: v.categoryId, date: v.date, note: v.note,
              source: 'ui',
            });
          }}
        />
      )}
    </AppShell>
  );
}
