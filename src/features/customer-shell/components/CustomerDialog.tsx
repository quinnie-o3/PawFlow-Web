import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "../customerShell.module.css";

export default function CustomerDialog({ title, description, busy, onClose, children, closeLabel = "Đóng chỉnh sửa" }: {
  title: string; description: string; busy: boolean; onClose: () => void; children: ReactNode; closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLInputElement>("input:not([readonly]):not(:disabled)")?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => {
      if (busy || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
      const first = controls[0]; const last = controls[controls.length - 1];
      if (first && last && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }}>
    <div className={styles.dialogHeading}>
      <h2 id={titleId}>{title}</h2>
      <button type="button" aria-label={closeLabel} disabled={busy} onClick={onClose} className={styles.closeButton}><X aria-hidden="true" size={20} /></button>
    </div>
    <p id={descriptionId} className={styles.dialogDescription}>{description}</p>
    {children}
  </dialog>;
}
