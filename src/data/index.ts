/** เลือกแหล่งข้อมูลที่แอปกำลังใช้อยู่
 *  ค่าเริ่มต้นคือโหมดจริง (ว่างเปล่า) ไม่ใช่ข้อมูลตัวอย่าง
 *  เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าตัวเลขสมมติคือเงินของตัวเอง */

import { LocalDataSource } from './localSource';
import type { DataSource } from './source';

export type SourceMode = 'real' | 'sample';

const MODE_KEY = 'mylog.mode';

export function readMode(): SourceMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'sample' ? 'sample' : 'real';
  } catch {
    return 'real';
  }
}

export function writeMode(mode: SourceMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ไม่เป็นไร */ }
}

const cache = new Map<SourceMode, DataSource>();

export function getDataSource(mode: SourceMode): DataSource {
  const hit = cache.get(mode);
  if (hit) return hit;
  const src = new LocalDataSource(mode);
  cache.set(mode, src);
  return src;
}

export { LocalDataSource } from './localSource';
export { AppsScriptDataSource } from './appsScriptSource';
export * from './source';
