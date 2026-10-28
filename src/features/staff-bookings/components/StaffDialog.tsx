"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "../staffBookings.module.css";

export default function StaffDialog({ title, children, busy = false, onClose }: { title: string; children: ReactNode; busy?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      else document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    };
  }, []);

  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy} className={styles.dialog}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => {
      if (busy || event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
      if (controls.length === 0) { event.preventDefault(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }}>
    <div className={styles.dialogHeading}><h2 id={titleId}>{title}</h2><button type="button" autoFocus disabled={busy} aria-label="Đóng chi tiết" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
    <p className={styles.muted}>PawCare Studio · Dữ liệu mô phỏng trong phiên</p>
    {children}
    <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>Đóng</button>
  </dialog>;
}
