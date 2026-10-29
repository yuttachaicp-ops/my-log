/** สถานะกลางที่ใช้ซ้ำทั้งแอป: loading / empty / error */

export function Loading({ text = 'กำลังโหลดข้อมูล…' }: { text?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" />
      {text}
    </div>
  );
}

export function Empty({ icon = '🪴', text, hint }: { icon?: string; text: string; hint?: string }) {
  return (
    <div className="state">
      <span className="big" aria-hidden="true">{icon}</span>
      {text}
      {hint && <div style={{ marginTop: 6, fontSize: 13 }}>{hint}</div>}
    </div>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <span className="big" aria-hidden="true">⚠️</span>
      {text}
      {onRetry && (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>ลองใหม่</button>
        </div>
      )}
    </div>
  );
}

export function CardSkeleton({ height = 120 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}
