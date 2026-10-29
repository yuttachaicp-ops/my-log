/** เลือกแหล่งข้อมูลที่แอปกำลังใช้อยู่
 *
 *  real   = เก็บในเครื่องนี้เท่านั้น (ค่าเริ่มต้น)
 *  sample = ข้อมูลตัวอย่างไว้ดูหน้าตา เก็บคนละที่กับของจริง
 *  cloud  = Supabase ซิงค์ทุกเครื่อง ต้องตั้งค่าและเข้าสู่ระบบก่อน
 *
 *  ค่าเริ่มต้นคือโหมดจริงในเครื่อง ไม่ใช่ข้อมูลตัวอย่าง
 *  เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าตัวเลขสมมติคือเงินของตัวเอง
 */

import { LocalDataSource } from './localSource';
import { SupabaseDataSource, isCloudReady, readCloudConfig } from './supabaseSource';
import { AppError, type DataSource } from './source';

export type SourceMode = 'real' | 'sample' | 'cloud';

const MODE_KEY = 'mylog.mode';

export function readMode(): SourceMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'sample') return 'sample';
    // ถ้าเคยเลือกคลาวด์ไว้แต่ตอนนี้ยังไม่พร้อม ให้ตกกลับมาที่เครื่องแทนหน้าจอพัง
    if (v === 'cloud') return isCloudReady() ? 'cloud' : 'real';
    return 'real';
  } catch {
    return 'real';
  }
}

export function writeMode(mode: SourceMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ไม่เป็นไร */ }
}

const cache = new Map<string, DataSource>();

export function getDataSource(mode: SourceMode): DataSource {
  if (mode === 'cloud') {
    const cfg = readCloudConfig();
    if (!cfg) throw new AppError('ยังไม่ได้ตั้งค่าคลาวด์');
    const key = `cloud:${cfg.url}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const src = new SupabaseDataSource(cfg);
    cache.set(key, src);
    return src;
  }

  const hit = cache.get(mode);
  if (hit) return hit;
  const src = new LocalDataSource(mode);
  cache.set(mode, src);
  return src;
}

/** ล้างแคชเมื่อผู้ใช้เปลี่ยนการตั้งค่าคลาวด์หรือเข้าสู่ระบบใหม่ */
export function resetSourceCache(): void {
  cache.clear();
}

export { LocalDataSource } from './localSource';
export { AppsScriptDataSource } from './appsScriptSource';
export * from './supabaseSource';
export * from './source';
