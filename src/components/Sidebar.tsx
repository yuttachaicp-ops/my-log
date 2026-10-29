import { PAGES, type PageKey } from '../pages/pages';

interface Props {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  onAdd: () => void;
}

export function Sidebar({ page, onNavigate, onAdd }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">✦</div>
        <div>
          <div className="brand-name">My Log</div>
          <div className="brand-sub">บันทึกการเงินของคุณ</div>
        </div>
      </div>

      <nav className="nav" aria-label="เมนูหลัก">
        <div className="nav-label">เมนู</div>
        {PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            className="nav-item"
            aria-current={page === p.key ? 'page' : undefined}
            onClick={() => onNavigate(p.key)}
          >
            <span className="nav-ic" aria-hidden="true">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <button className="btn btn-primary btn-block" onClick={onAdd}>
          ＋ เพิ่มรายการ
        </button>
      </div>
    </aside>
  );
}
