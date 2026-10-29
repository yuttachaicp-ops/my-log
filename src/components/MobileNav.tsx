import { PAGES, type PageKey } from '../pages/pages';

interface Props {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
}

/** แถบล่างบนมือถือ แสดงครบทุกหน้า รวมถึงตั้งค่า
 *  เพราะบนจอแคบไม่มี sidebar ถ้าไม่ใส่ไว้ที่นี่จะเข้าหน้าตั้งค่าไม่ได้เลย */
export function MobileNav({ page, onNavigate }: Props) {
  return (
    <nav className="mobile-nav" aria-label="เมนูหลัก (มือถือ)">
      {PAGES.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-current={page === p.key ? 'page' : undefined}
          onClick={() => onNavigate(p.key)}
        >
          <span className="ic" aria-hidden="true">{p.icon}</span>
          {p.short}
        </button>
      ))}
    </nav>
  );
}
