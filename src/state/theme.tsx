/** ระบบธีม Light / Dark / ตามระบบ
 *
 *  วิธีทำงาน: เก็บ "ความตั้งใจ" ของผู้ใช้ (system | light | dark) ไว้ใน localStorage
 *  แล้ว JS แปลงเป็นธีมจริง (light | dark) ใส่ลง data-theme บน <html>
 *  CSS จึงมีแค่สองชุด ไม่ต้องเขียน media query ซ้ำในทุก selector
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'mylog.theme';
const QUERY = '(prefers-color-scheme: dark)';

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia(QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(pref: ThemePref): Theme {
  return pref === 'system' ? systemTheme() : pref;
}

/** ใส่ธีมลง <html> และอัปเดต theme-color ให้แถบสถานะมือถือเปลี่ยนตาม */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#171D1A' : '#4E735F');
}

interface ThemeValue {
  pref: ThemePref;
  theme: Theme;
  setPref(p: ThemePref): void;
  /** สลับระหว่างสว่างกับมืดในคลิกเดียว ใช้กับปุ่มบน Top Bar */
  toggle(): void;
}

const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readPref()));

  useEffect(() => {
    const next = resolveTheme(pref);
    setTheme(next);
    applyTheme(next);
  }, [pref]);

  // ถ้าเลือก "ตามระบบ" ต้องขยับตามเมื่อผู้ใช้สลับธีมของเครื่องระหว่างใช้งาน
  useEffect(() => {
    if (pref !== 'system') return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(QUERY);
    } catch {
      return;
    }
    const onChange = () => {
      const next = systemTheme();
      setTheme(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    try { localStorage.setItem(KEY, p); } catch { /* โหมดส่วนตัวอาจเขียนไม่ได้ */ }
    setPrefState(p);
  }, []);

  const toggle = useCallback(() => {
    setPref(resolveTheme(readPref()) === 'dark' ? 'light' : 'dark');
  }, [setPref]);

  const value = useMemo(() => ({ pref, theme, setPref, toggle }), [pref, theme, setPref, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme ต้องอยู่ภายใต้ ThemeProvider');
  return v;
}
