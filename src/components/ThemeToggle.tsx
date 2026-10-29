import { useTheme } from '../state/theme';

/** ปุ่มสลับธีมบน Top Bar — ดวงอาทิตย์ตอนอยู่โหมดสว่าง พระจันทร์ตอนอยู่โหมดมืด
 *  ไอคอนบอก "ธีมที่ใช้อยู่" ส่วน tooltip บอกว่ากดแล้วจะไปโหมดไหน */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const goingTo = theme === 'dark' ? 'สว่าง' : 'มืด';
  const label = `สลับเป็นโหมด${goingTo}`;

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
    </button>
  );
}
