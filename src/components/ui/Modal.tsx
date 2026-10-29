/** Modal ที่ปิดด้วย Esc คลิกฉากหลัง และคืน focus ให้ปุ่มที่เรียกเปิด */

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}

export function Modal({ title, onClose, children, labelledBy = 'modal-title' }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = boxRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.modal-close)',
    );
    first?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={boxRef}>
        <div className="modal-head">
          <h3 id={labelledBy}>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิดหน้าต่าง">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** กล่องยืนยันก่อนลบ ใช้ซ้ำได้ทุกที่ */
export function ConfirmDialog({
  title, message, confirmText = 'ลบ', onConfirm, onCancel,
}: {
  title: string; message: string; confirmText?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} labelledBy="confirm-title">
      <p style={{ margin: '0 0 4px', fontSize: 14, lineHeight: 1.7 }}>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmText}</button>
      </div>
    </Modal>
  );
}
