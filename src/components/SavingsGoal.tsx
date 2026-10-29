import type { SavingsGoal as Goal } from '../types';
import { formatPercent, formatTHB } from '../lib/money';
import { formatDateTH } from '../lib/date';
import { Empty } from './ui/States';

const SIZE = 64;
const R = 26;
const C = 2 * Math.PI * R;

function Ring({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--sage)" strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${clamped * C} ${C}`}
        />
      </g>
      <text x={SIZE / 2} y={SIZE / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">
        {Math.round(clamped * 100)}%
      </text>
    </svg>
  );
}

interface Props {
  goals: Goal[];
  onEdit?: (g: Goal) => void;
  onDelete?: (g: Goal) => void;
}

export function SavingsGoalList({ goals, onEdit, onDelete }: Props) {
  if (!goals.length) {
    return <Empty icon="🌱" text="ยังไม่มีเป้าหมายเงินออม" hint="ตั้งเป้าหมายแรกเพื่อเริ่มเก็บเงิน" />;
  }

  return (
    <div>
      {goals.map((g) => {
        const ratio = g.targetAmount === 0 ? 0 : g.savedAmount / g.targetAmount;
        return (
          <div className="goal" key={g.id} style={{ marginBottom: 16 }}>
            <Ring ratio={ratio} />
            <div className="goal-info">
              <div className="goal-name">{g.name}</div>
              <div className="goal-sub">
                เก็บแล้ว {formatTHB(g.savedAmount)} จาก {formatTHB(g.targetAmount)}
                {' · '}{formatPercent(ratio)}
              </div>
              {g.dueDate && (
                <div className="goal-sub">ภายใน {formatDateTH(g.dueDate)}</div>
              )}
            </div>
            {(onEdit || onDelete) && (
              <div className="row-actions">
                {onEdit && (
                  <button
                    type="button" className="icon-btn" onClick={() => onEdit(g)}
                    aria-label={`แก้ไขเป้าหมาย ${g.name}`}
                  >
                    ✎
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button" className="icon-btn danger" onClick={() => onDelete(g)}
                    aria-label={`ลบเป้าหมาย ${g.name}`}
                  >
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
