/** โครงหน้าหลัก: sidebar บน desktop, แถบล่างบน mobile, top bar, toast */

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TopBar } from './TopBar';
import { UpdateBanner } from './UpdateBanner';
import { useStore } from '../state/store';
import type { PageKey } from '../pages/pages';

interface Props {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  onAdd: () => void;
  children: ReactNode;
}

export function AppShell({ page, onNavigate, onAdd, children }: Props) {
  const { toasts, mode, setMode } = useStore();

  return (
    <div className="shell">
      <Sidebar page={page} onNavigate={onNavigate} onAdd={onAdd} />

      <div className="main">
        <TopBar page={page} />

        <div className="content">
          {mode === 'sample' && (
            <div className="sample-banner" role="status">
              <span aria-hidden="true">🧪</span>
              <span>
                <strong>กำลังดูข้อมูลตัวอย่าง</strong> — ตัวเลขทั้งหมดสมมติขึ้นเพื่อดูหน้าตาแอป
                ไม่ใช่เงินจริงของคุณ และเก็บแยกจากข้อมูลจริงคนละที่
              </span>
              <button type="button" onClick={() => setMode('real')}>
                กลับไปข้อมูลของฉัน
              </button>
            </div>
          )}
          {children}
        </div>
      </div>

      <button className="fab" onClick={onAdd} aria-label="เพิ่มรายการใหม่">＋</button>
      <MobileNav page={page} onNavigate={onNavigate} />

      <UpdateBanner />

      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
