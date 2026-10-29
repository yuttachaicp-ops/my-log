/* Service worker ของ My Log
 *
 *  หน้าที่
 *    1. ทำให้เบราว์เซอร์ยอมให้ติดตั้งแอปลงจอโฮม
 *    2. เปิดแอปได้แม้ไม่มีเน็ต (ข้อมูลอยู่ใน localStorage อยู่แล้ว)
 *    3. แจ้งหน้าเว็บว่ามีเวอร์ชันใหม่ แล้วรอให้ผู้ใช้กดอัปเดตเอง
 *
 *  สำคัญ: ที่นี่ไม่เรียก skipWaiting() ตอน install โดยอัตโนมัติ
 *  เพราะถ้าเรียก เวอร์ชันใหม่จะเข้ามาแทนที่ทันทีแบบเงียบ ๆ
 *  ซึ่งอาจตัดกลางคันตอนผู้ใช้กำลังกรอกฟอร์มอยู่
 *  จึงปล่อยให้ worker ตัวใหม่ค้างสถานะ waiting จนกว่าหน้าเว็บจะส่งข้อความ 'skip-waiting' มา
 *
 *  เบราว์เซอร์ตัดสินว่ามีเวอร์ชันใหม่จากการเทียบไฟล์ sw.js แบบไบต์ต่อไบต์
 *  ถ้า sw.js เหมือนเดิมเป๊ะ มันจะไม่ถือว่ามีอัปเดต แม้ไฟล์อื่นจะเปลี่ยนไปแล้วก็ตาม
 *  จึงให้ Vite เติมรหัส build ลงใน __SW_BUILD__ ทุกครั้งที่ build (ดู plugin ใน vite.config.ts)
 *  ไม่ต้องขยับเลขเวอร์ชันเองให้ลืม
 */

const BUILD = '__SW_BUILD__';
const VERSION = `my-log-${BUILD}`;
const SHELL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([SHELL, './icon-192.png']))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg === 'skip-waiting' || (msg && msg.type === 'skip-waiting')) {
    self.skipWaiting();
    return;
  }
  if (msg === 'get-version' || (msg && msg.type === 'get-version')) {
    const reply = { type: 'version', version: VERSION, build: BUILD };
    if (event.ports && event.ports[0]) event.ports[0].postMessage(reply);
    else if (event.source) event.source.postMessage(reply);
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ห้ามแคชตัว sw.js และ manifest เด็ดขาด
  // ถ้าแคชไว้ การตรวจหาเวอร์ชันใหม่จะไปเจอของเก่าในแคชแทนของจริงบนเซิร์ฟเวอร์
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('.webmanifest')) return;

  // หน้า HTML — เอาของใหม่ก่อน ถ้าเน็ตล่มค่อยใช้ของเก่า
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    );
    return;
  }

  // asset ที่มี hash ในชื่อ — ใช้ของในแคชได้เลย
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || Response.error());
    }),
  );
});
