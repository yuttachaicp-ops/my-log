import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/** ประทับรหัส build ลงใน sw.js ของผลลัพธ์ หลัง Vite คัดลอกไฟล์จาก public/ เสร็จแล้ว
 *
 *  เบราว์เซอร์ตัดสินว่ามีเวอร์ชันใหม่จากการเทียบไฟล์ sw.js แบบไบต์ต่อไบต์
 *  ถ้าไฟล์เหมือนเดิมเป๊ะ ผู้ใช้จะไม่ได้รับแจ้งเลย แม้โค้ดส่วนอื่นจะเปลี่ยนไปแล้ว
 *  ตัวยึด __SW_BUILD__ โผล่ทั้งในคอมเมนต์และในค่าคงที่ จึงต้องแทนที่แบบ global */
function stampServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    configResolved(cfg: { build: { outDir: string } }) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const stamp = `${pkg.version}-${Date.now().toString(36)}`;
      writeFileSync(file, readFileSync(file, 'utf-8').replace(/__SW_BUILD__/g, stamp));
      console.log(`  stamp-service-worker: sw.js build = ${stamp}`);
    },
  };
}

export default defineConfig({
  // base แบบ relative ทำให้ deploy ได้ทั้งที่รากโดเมน (Netlify)
  // และในโฟลเดอร์ย่อย (GitHub Pages) โดยไม่ต้องแก้ config
  base: './',
  plugins: [react(), stampServiceWorker()],
  define: {
    // ฝังเลขเวอร์ชันและเวลา build ไว้ในโค้ด เพื่อให้หน้าตั้งค่าบอกได้ว่ากำลังใช้ตัวไหน
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: { port: 5173, host: true },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
} as any);
