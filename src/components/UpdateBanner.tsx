/** แถบแจ้งว่ามีเวอร์ชันใหม่ พร้อมปุ่มอัปเดต
 *  ขึ้นเหนือแถบเมนูล่างบนมือถือ และมุมล่างขวาบนจอใหญ่ */

import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateAvailable } from '../lib/pwa';

/** กด "ไว้ก่อน" แล้วเงียบไปสองชั่วโมง จะได้ไม่กวนซ้ำ ๆ ในการใช้งานรอบเดียว */
const SNOOZE_KEY = 'mylog.update.snoozeUntil';
const SNOOZE_MS = 2 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onUpdateAvailable((has) => {
    if (has && !snoozed()) setShow(true);
  }), []);

  if (!show) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="ub-ic" aria-hidden="true">✨</span>
      <div className="ub-text">
        <strong>มีเวอร์ชันใหม่พร้อมใช้งาน</strong>
        <span>กดอัปเดตแล้วแอปจะโหลดใหม่ ข้อมูลที่บันทึกไว้ยังอยู่ครบ</span>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm ub-later"
        onClick={() => {
          try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* ไม่เป็นไร */ }
          setShow(false);
        }}
      >
        ไว้ก่อน
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={() => { setBusy(true); applyUpdate(); }}
      >
        {busy ? 'กำลังอัปเดต…' : 'อัปเดตเลย'}
      </button>
    </div>
  );
}
