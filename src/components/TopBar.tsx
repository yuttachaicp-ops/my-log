import { useStore } from '../state/store';
import { currentMonth, formatMonthTH, shiftMonth } from '../lib/date';
import { PAGE_TITLE, type PageKey } from '../pages/pages';
import { ThemeToggle } from './ThemeToggle';

export function TopBar({ page }: { page: PageKey }) {
  const { month, setMonth } = useStore();
  const atLatest = month >= currentMonth();
  const showMonth = page !== 'settings' && page !== 'categories';

  return (
    <header className="topbar">
      <h1 className="page-title">{PAGE_TITLE[page]}</h1>

      {showMonth && (
        <div className="month-picker">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="เดือนก่อนหน้า"
          >
            ‹
          </button>
          <span className="month-label" aria-live="polite">{formatMonthTH(month)}</span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={atLatest}
            aria-label="เดือนถัดไป"
          >
            ›
          </button>
        </div>
      )}

      <ThemeToggle />
      <div className="avatar" aria-hidden="true">T</div>
    </header>
  );
}
