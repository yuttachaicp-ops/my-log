export type PageKey = 'dashboard' | 'transactions' | 'categories' | 'budget' | 'settings';

export const PAGES: {
  key: PageKey;
  label: string;
  /** ป้ายสั้นสำหรับแถบล่างบนมือถือ ที่กว้างต่อช่องมีไม่มาก */
  short: string;
  icon: string;
}[] = [
  { key: 'dashboard',    label: 'ภาพรวม',        short: 'ภาพรวม',  icon: '🏠' },
  { key: 'transactions', label: 'รายการทั้งหมด', short: 'รายการ',  icon: '🧾' },
  { key: 'categories',   label: 'หมวดหมู่',       short: 'หมวดหมู่', icon: '🏷️' },
  { key: 'budget',       label: 'งบและเป้าหมาย',  short: 'งบ',      icon: '🎯' },
  { key: 'settings',     label: 'ตั้งค่า',         short: 'ตั้งค่า',  icon: '⚙️' },
];

export const PAGE_TITLE: Record<PageKey, string> = {
  dashboard: 'ภาพรวม',
  transactions: 'รายการทั้งหมด',
  categories: 'หมวดหมู่',
  budget: 'งบประมาณและเป้าหมาย',
  settings: 'ตั้งค่า',
};
