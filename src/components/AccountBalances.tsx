import type { AccountBalance } from '../types';
import { formatTHB } from '../lib/money';
import { Empty } from './ui/States';

/** ยอดคงเหลือแยกรายบัญชี บัตรเครดิตที่ติดลบคือยอดที่ยังค้างจ่าย */
export function AccountBalances({ rows }: { rows: AccountBalance[] }) {
  if (!rows.length) return <Empty icon="👛" text="ยังไม่มีบัญชี" hint="เพิ่มบัญชีได้ที่หน้าตั้งค่า" />;

  return (
    <ul className="cat-list">
      {rows.map((a) => (
        <li key={a.accountId} className="acc-row">
          <span className="acc-ic" style={{ background: a.color + '22' }} aria-hidden="true">
            {a.icon}
          </span>
          <span className="nm">
            {a.name}
            {a.kind === 'credit' && a.balance < 0 && (
              <span className="badge due" style={{ marginLeft: 6 }}>ค้างจ่าย</span>
            )}
          </span>
          <span className={`am ${a.balance < 0 ? 'amount-out' : ''}`}>{formatTHB(a.balance)}</span>
        </li>
      ))}
    </ul>
  );
}
