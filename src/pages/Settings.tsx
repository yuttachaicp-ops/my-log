import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { LocalDataSource } from '../data';
import { formatTHB, parseAmount } from '../lib/money';
import { ConfirmDialog } from '../components/ui/Modal';
import { useTheme, type ThemePref } from '../state/theme';
import { checkForUpdate, isServiceWorkerActive } from '../lib/pwa';
import { formatDateTH } from '../lib/date';

const THEME_OPTIONS: { key: ThemePref; label: string; icon: string; note: string }[] = [
  { key: 'light', label: 'สว่าง', icon: '☀️', note: 'โทนครีมตามดีไซน์หลัก' },
  { key: 'dark', label: 'มืด', icon: '🌙', note: 'โทนมืดอบอุ่น ไม่ดำสนิท' },
  { key: 'system', label: 'ตามระบบ', icon: '🖥️', note: 'เปลี่ยนตามเครื่องของคุณ' },
];

export function Settings() {
  const { data, mode, setMode, setOpeningBalance, source, pushToast, reload } = useStore();
  const d = data!;
  const { pref, theme, setPref } = useTheme();
  const [opening, setOpening] = useState(String(d.settings.openingBalance));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ text: string; count: number } | null>(null);
  const [checking, setChecking] = useState(false);

  async function runUpdateCheck() {
    setChecking(true);
    try {
      const found = await checkForUpdate();
      pushToast(
        found ? 'เจอเวอร์ชันใหม่ กดอัปเดตที่แถบด้านล่างได้เลย' : 'ใช้เวอร์ชันล่าสุดอยู่แล้ว',
        found ? 'success' : 'info',
      );
    } finally {
      setChecking(false);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { transactions?: unknown[] };
      const count = Array.isArray(parsed.transactions) ? parsed.transactions.length : 0;
      if (!count) {
        pushToast('ไฟล์นี้ไม่มีรายการให้นำเข้า', 'error');
        return;
      }
      setPendingImport({ text, count });
    } catch {
      pushToast('อ่านไฟล์ไม่สำเร็จ ต้องเป็นไฟล์ JSON ที่ส่งออกจากแอปนี้', 'error');
    }
  }

  async function confirmImport() {
    if (!pendingImport || !(source instanceof LocalDataSource)) return;
    setBusy(true);
    try {
      const n = await source.importJSON(pendingImport.text, 'replace');
      await reload();
      pushToast(`นำเข้า ${n} รายการแล้ว`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
      setPendingImport(null);
    }
  }

  async function saveOpening(e: React.FormEvent) {
    e.preventDefault();
    const v = parseAmount(opening);
    if (v === null) { pushToast('ยอดยกมาต้องเป็นตัวเลข', 'error'); return; }
    setBusy(true);
    await setOpeningBalance(v);
    setBusy(false);
  }

  async function exportJSON() {
    if (!(source instanceof LocalDataSource)) {
      pushToast('แหล่งข้อมูลนี้ยังไม่รองรับการส่งออก', 'error');
      return;
    }
    try {
      const text = await source.exportJSON();
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-log-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast('ส่งออกข้อมูลแล้ว', 'success');
    } catch {
      pushToast('ส่งออกข้อมูลไม่สำเร็จ', 'error');
    }
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">ธีมหน้าจอ</div>
            <div className="card-subtitle">
              ตอนนี้ใช้โหมด{theme === 'dark' ? 'มืด' : 'สว่าง'}
              {pref === 'system' ? ' (ตามระบบ)' : ''} — ค่าที่เลือกถูกจำไว้หลังรีเฟรช
            </div>
          </div>
        </div>
        <div
          className="type-toggle"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
          role="group"
          aria-label="เลือกธีม"
        >
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="income"
              aria-pressed={pref === o.key}
              onClick={() => setPref(o.key)}
              title={o.note}
            >
              <span aria-hidden="true">{o.icon}</span> {o.label}
            </button>
          ))}
        </div>
        <div className="note" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {THEME_OPTIONS.find((o) => o.key === pref)?.note}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">แหล่งข้อมูลที่กำลังดู</div>
            <div className="card-subtitle">
              ข้อมูลจริงกับข้อมูลตัวอย่างเก็บแยกกันคนละที่ สลับไปมาได้โดยไม่มีอะไรหาย
            </div>
          </div>
        </div>

        <div className="type-toggle" role="group" aria-label="เลือกแหล่งข้อมูล">
          <button
            type="button" className="income" aria-pressed={mode === 'real'}
            onClick={() => setMode('real')}
          >
            ข้อมูลของฉัน
          </button>
          <button
            type="button" className="expense" aria-pressed={mode === 'sample'}
            onClick={() => setMode('sample')}
          >
            ข้อมูลตัวอย่าง
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
          ตอนนี้ข้อมูลเก็บอยู่ในเครื่องนี้ (localStorage) ไม่ได้ส่งออกไปไหน
          การเชื่อมกับ Google Sheet ของ LINE Bot เดิมยังไม่ได้เปิดใช้
          เพราะยังไม่ได้ตรวจ schema ของชีต
        </div>
      </section>

      <section className="card" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">ยอดยกมาต้นงวด</div>
            <div className="card-subtitle">
              ใช้เป็นจุดตั้งต้นของยอดคงเหลือ ตอนนี้คือ {formatTHB(d.settings.openingBalance)}
            </div>
          </div>
        </div>
        <form onSubmit={saveOpening} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="sr-only" htmlFor="opening">ยอดยกมา</label>
          <input
            id="opening" className="input" style={{ maxWidth: 220 }}
            inputMode="decimal" value={opening}
            onChange={(e) => setOpening(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy}>บันทึก</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">สำรองและย้ายข้อมูล</div>
            <div className="card-subtitle">
              ส่งออกเก็บไว้ หรือนำเข้าไฟล์ JSON เพื่อย้ายข้อมูลมาจากเครื่องอื่น
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={exportJSON}>ส่งออกข้อมูลชุดนี้</button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            นำเข้าจากไฟล์ JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={pickFile}
            className="sr-only"
            aria-label="เลือกไฟล์ JSON ที่จะนำเข้า"
          />
        </div>
        <div className="note" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
          การนำเข้าจะแทนที่ข้อมูลใน{mode === 'sample' ? 'ชุดตัวอย่าง' : 'ชุดของฉัน'}ทั้งหมด
          ควรส่งออกเก็บไว้ก่อนทุกครั้ง
        </div>
      </section>

      <section className="card" style={{ marginTop: 'var(--gap)' }}>
        <div className="card-head">
          <div>
            <div className="card-title">เวอร์ชันของแอป</div>
            <div className="card-subtitle">
              เมื่อมีเวอร์ชันใหม่ แอปจะขึ้นแถบแจ้งให้กดอัปเดตเองที่ด้านล่างจอ
            </div>
          </div>
        </div>
        <div className="version-row" style={{ marginBottom: 12 }}>
          <span className="version-chip">v{__APP_VERSION__}</span>
          <span>build {formatDateTH(__BUILD_TIME__.slice(0, 10))}</span>
          <span>
            {isServiceWorkerActive()
              ? '· ติดตั้งเป็นแอปแล้ว ตรวจอัปเดตได้'
              : '· ยังไม่ได้ทำงานผ่าน service worker (เปิดจาก dev server หรือยังไม่ได้โหลดซ้ำ)'}
          </span>
        </div>
        <button className="btn btn-ghost" onClick={runUpdateCheck} disabled={checking}>
          {checking ? 'กำลังตรวจ…' : 'ตรวจหาเวอร์ชันใหม่'}
        </button>
      </section>

      {pendingImport && (
        <ConfirmDialog
          title="นำเข้าข้อมูลทับของเดิม?"
          message={
            `ไฟล์นี้มี ${pendingImport.count} รายการ เมื่อยืนยันแล้ว รายการเดิมทั้งหมดใน` +
            `${mode === 'sample' ? 'ชุดตัวอย่าง' : 'ชุดของฉัน'}จะถูกแทนที่ และย้อนกลับไม่ได้`
          }
          confirmText="นำเข้าและแทนที่"
          onConfirm={confirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </>
  );
}
