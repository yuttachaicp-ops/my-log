/** การ์ดตั้งค่าซิงค์ข้ามเครื่องในหน้าตั้งค่า
 *
 *  ขั้นตอนของผู้ใช้: ใส่ URL กับ anon key ของโปรเจกต์ Supabase → เข้าสู่ระบบ
 *  → ถ้าเพิ่งย้ายมา กดส่งข้อมูลในเครื่องขึ้นคลาวด์ครั้งเดียว
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import {
  LocalDataSource, SupabaseDataSource, cloudSignIn, cloudSignOut, cloudSignUp,
  readCloudConfig, readSession, writeCloudConfig, type CloudConfig,
} from '../data';
import { ConfirmDialog } from './ui/Modal';

export function CloudPanel() {
  const { mode, setMode, refreshSource, pushToast, reload } = useStore();
  const saved = readCloudConfig();
  const session = readSession();

  const [url, setUrl] = useState(saved?.url ?? '');
  const [key, setKey] = useState(saved?.anonKey ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmUpload, setConfirmUpload] = useState(false);

  function saveConfig(): CloudConfig | null {
    const u = url.trim().replace(/\/+$/, '');
    const k = key.trim();
    if (!/^https:\/\/.+\.supabase\.co$/.test(u)) {
      pushToast('ที่อยู่ควรเป็นแบบ https://xxxx.supabase.co', 'error');
      return null;
    }
    if (k.length < 20) {
      pushToast('anon key ดูสั้นผิดปกติ ลองคัดลอกใหม่', 'error');
      return null;
    }
    const cfg = { url: u, anonKey: k };
    writeCloudConfig(cfg);
    refreshSource();
    return cfg;
  }

  async function doAuth(kind: 'in' | 'up') {
    const cfg = saveConfig();
    if (!cfg) return;
    if (!email.trim() || !password) {
      pushToast('กรุณาใส่อีเมลและรหัสผ่าน', 'error');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'up') await cloudSignUp(cfg, email.trim(), password);
      else await cloudSignIn(cfg, email.trim(), password);
      setPassword('');
      refreshSource();
      setMode('cloud');
      pushToast('เชื่อมต่อคลาวด์แล้ว', 'success');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'เชื่อมต่อไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadLocal() {
    const cfg = readCloudConfig();
    if (!cfg) return;
    setBusy(true);
    try {
      const local = new LocalDataSource('real');
      const data = await local.load();
      const cloud = new SupabaseDataSource(cfg);
      const n = await cloud.importDataset(data, true);
      refreshSource();
      setMode('cloud');
      await reload();
      pushToast(`ส่งขึ้นคลาวด์แล้ว ${n} รายการ`, 'success');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'ส่งขึ้นคลาวด์ไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
      setConfirmUpload(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 'var(--gap)' }}>
      <div className="card-head">
        <div>
          <div className="card-title">ซิงค์ข้ามเครื่อง (Supabase)</div>
          <div className="card-subtitle">
            {session
              ? `เชื่อมต่อแล้วในชื่อ ${session.email}`
              : 'ให้มือถือกับคอมเห็นข้อมูลชุดเดียวกัน'}
          </div>
        </div>
      </div>

      <div className="hint-box">
        ข้อมูลการเงินจะออกจากเครื่องนี้ไปเก็บบนเซิร์ฟเวอร์ Supabase ของคุณเอง
        ทุกตารางเปิด Row Level Security ผูกกับบัญชีที่ล็อกอิน คนอื่นอ่านไม่ได้
        ขั้นตอนตั้งค่าดูในไฟล์ <code>SETUP-CLOUD-SYNC.md</code>
      </div>

      {!session && (
        <>
          <label className="field">
            <span>Project URL</span>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxxxxx.supabase.co" autoComplete="off" />
          </label>
          <label className="field">
            <span>anon public key</span>
            <input className="input" value={key} onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOi..." autoComplete="off" />
          </label>
          <div className="field-row">
            <label className="field">
              <span>อีเมล</span>
              <input className="input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </label>
            <label className="field">
              <span>รหัสผ่าน</span>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => doAuth('in')}>
              เข้าสู่ระบบ
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => doAuth('up')}>
              สมัครใหม่
            </button>
          </div>
        </>
      )}

      {session && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn ${mode === 'cloud' ? 'btn-ghost' : 'btn-primary'}`}
            disabled={busy || mode === 'cloud'}
            onClick={() => { setMode('cloud'); void reload(); }}
          >
            {mode === 'cloud' ? 'กำลังใช้ข้อมูลคลาวด์อยู่' : 'สลับมาใช้ข้อมูลคลาวด์'}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmUpload(true)}>
            ส่งข้อมูลในเครื่องขึ้นคลาวด์
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => {
              cloudSignOut();
              refreshSource();
              setMode('real');
              pushToast('ออกจากระบบคลาวด์แล้ว กลับมาใช้ข้อมูลในเครื่อง', 'info');
            }}
          >
            ออกจากระบบคลาวด์
          </button>
        </div>
      )}

      {confirmUpload && (
        <ConfirmDialog
          title="ส่งข้อมูลในเครื่องขึ้นคลาวด์?"
          message={
            'ข้อมูลบนคลาวด์ทั้งหมดจะถูกแทนที่ด้วยชุดที่อยู่ในเครื่องนี้ ' +
            'ส่วนข้อมูลในเครื่องยังอยู่เหมือนเดิมไม่ถูกแตะ เหมาะใช้ตอนย้ายมาครั้งแรกเท่านั้น'
          }
          confirmText="ส่งขึ้นคลาวด์"
          onConfirm={uploadLocal}
          onCancel={() => setConfirmUpload(false)}
        />
      )}
    </section>
  );
}
