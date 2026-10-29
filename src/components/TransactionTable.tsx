import type { Category, Transaction } from '../types';
import { formatDateTH } from '../lib/date';
import { formatTHB } from '../lib/money';
import { Empty } from './ui/States';

interface Props {
  rows: Transaction[];
  categories: Category[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  /** จำกัดจำนวนแถว ใช้ในการ์ด "รายการล่าสุด" */
  limit?: number;
  emptyText?: string;
}

export function TransactionTable({
  rows, categories, onEdit, onDelete, limit, emptyText = 'ยังไม่มีรายการ',
}: Props) {
  const list = limit ? rows.slice(0, limit) : rows;

  if (!list.length) {
    return <Empty icon="🧾" text={emptyText} hint="กด “＋ เพิ่มรายการ” เพื่อเริ่มบันทึก" />;
  }

  const catOf = (id: string) => categories.find((c) => c.id === id);

  return (
    <div className="table-wrap">
      <table className="tx-table">
        <thead>
          <tr>
            <th scope="col">รายการ</th>
            <th scope="col">หมวดหมู่</th>
            <th scope="col">วันที่</th>
            <th scope="col" className="num">จำนวนเงิน</th>
            {(onEdit || onDelete) && <th scope="col"><span className="sr-only">จัดการ</span></th>}
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const c = catOf(t.categoryId);
            const out = t.type === 'expense';
            return (
              <tr key={t.id}>
                <td>
                  <div className="tx-name">
                    <span className={`tx-icon ${out ? 'out' : ''}`} aria-hidden="true">
                      {c ? c.icon : '•'}
                    </span>
                    <div className="tx-text">
                      <div className="tx-title">{t.name}</div>
                      <span className="tx-sub tx-sub-cat">
                        {c ? c.name : 'ไม่ระบุหมวด'}
                      </span>
                      {t.note && <div className="tx-sub">{t.note}</div>}
                    </div>
                  </div>
                </td>
                <td><span className="pill">{c ? c.name : 'ไม่ระบุหมวด'}</span></td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                  {formatDateTH(t.date)}
                </td>
                <td className={`num ${out ? 'amount-out' : 'amount-in'}`}>
                  {out ? '−' : '+'}{formatTHB(t.amount)}
                </td>
                {(onEdit || onDelete) && (
                  <td>
                    <div className="row-actions">
                      {onEdit && (
                        <button
                          type="button" className="icon-btn"
                          onClick={() => onEdit(t)}
                          aria-label={`แก้ไขรายการ ${t.name}`}
                        >
                          ✎
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button" className="icon-btn danger"
                          onClick={() => onDelete(t)}
                          aria-label={`ลบรายการ ${t.name}`}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
