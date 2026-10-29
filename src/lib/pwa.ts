/** จัดการ service worker และการแจ้งเตือนเวอร์ชันใหม่
 *
 *  ลำดับที่เกิดขึ้นจริงเวลา deploy ของใหม่
 *    1. เบราว์เซอร์โหลด sw.js มาเทียบ เห็นว่าไฟล์ไม่เหมือนเดิม จึงติดตั้ง worker ตัวใหม่
 *    2. worker ใหม่ติดตั้งเสร็จแต่ "รอ" อยู่ เพราะตัวเก่ายังคุมหน้าเว็บอยู่
 *    3. ตรงนี้เราแจ้งผู้ใช้ว่ามีเวอร์ชันใหม่
 *    4. ผู้ใช้กดอัปเดต เราส่ง 'skip-waiting' ให้ worker ใหม่ขึ้นมาคุมแทน
 *    5. เบราว์เซอร์ยิง controllerchange เรารีโหลดหน้าให้อัตโนมัติ
 */

export type UpdateListener = (hasUpdate: boolean) => void;

let registration: ServiceWorkerRegistration | null = null;
let listener: UpdateListener | null = null;
let reloading = false;

function notify(hasUpdate: boolean): void {
  if (listener) listener(hasUpdate);
}

/** worker ที่ติดตั้งเสร็จแล้วและกำลังรอคิวอยู่ ถ้ามีแปลว่ามีเวอร์ชันใหม่ */
function waitingWorker(): ServiceWorker | null {
  return registration?.waiting ?? null;
}

function watchInstalling(reg: ServiceWorkerRegistration): void {
  const sw = reg.installing;
  if (!sw) return;
  sw.addEventListener('statechange', () => {
    // มี controller อยู่แล้ว = ไม่ใช่การติดตั้งครั้งแรก แปลว่าเป็นของอัปเดต
    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
      notify(true);
    }
  });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker
      .register(url, { scope: './' })
      .then((reg) => {
        registration = reg;

        // เปิดแอปมาแล้วมีของใหม่รออยู่ตั้งแต่คราวก่อน
        if (reg.waiting && navigator.serviceWorker.controller) notify(true);

        watchInstalling(reg);
        reg.addEventListener('updatefound', () => watchInstalling(reg));

        // ตรวจหาเวอร์ชันใหม่เวลากลับมาเปิดแอป และทุก 30 นาทีระหว่างเปิดค้างไว้
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) void reg.update().catch(() => undefined);
        });
        setInterval(() => void reg.update().catch(() => undefined), 30 * 60 * 1000);
      })
      .catch(() => {
        // ลงทะเบียนไม่สำเร็จไม่ใช่เรื่องคอขาดบาดตาย แอปยังใช้งานได้ตามปกติ
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

/** ให้ UI มาสมัครรับข่าวว่ามีเวอร์ชันใหม่ */
export function onUpdateAvailable(fn: UpdateListener): () => void {
  listener = fn;
  if (waitingWorker() && navigator.serviceWorker?.controller) fn(true);
  return () => {
    if (listener === fn) listener = null;
  };
}

/** ผู้ใช้กดอัปเดต — สั่งให้ worker ใหม่ขึ้นมาคุม แล้วหน้าเว็บจะรีโหลดเองจาก controllerchange */
export function applyUpdate(): void {
  const w = waitingWorker();
  if (!w) {
    window.location.reload();
    return;
  }
  w.postMessage('skip-waiting');

  // กันเหนียว ถ้า controllerchange ไม่มาภายใน 4 วินาที ให้รีโหลดเอง
  setTimeout(() => {
    if (!reloading) {
      reloading = true;
      window.location.reload();
    }
  }, 4000);
}

/** กดตรวจหาอัปเดตเองจากหน้าตั้งค่า คืนค่าว่าเจอของใหม่หรือไม่ */
export async function checkForUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = registration || (await navigator.serviceWorker.getRegistration()) || null;
  if (!reg) return false;
  registration = reg;
  try {
    await reg.update();
  } catch {
    return false;
  }
  const found = !!reg.waiting && !!navigator.serviceWorker.controller;
  if (found) notify(true);
  return found;
}

/** true เมื่อแอปทำงานผ่าน service worker อยู่จริง ใช้บอกผู้ใช้ในหน้าตั้งค่า */
export function isServiceWorkerActive(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
}
