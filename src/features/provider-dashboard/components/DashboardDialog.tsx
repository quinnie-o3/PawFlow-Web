"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "../dashboard.module.css";

export default function DashboardDialog({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[560px] overflow-y-auto rounded-[8px] border-0 bg-white p-6 text-[var(--text-primary)] shadow-xl backdrop:bg-black/40">
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-[20px] font-bold leading-[26px]">{title}</h2>
        <button type="button" onClick={onClose} autoFocus aria-label="Đóng" title="Đóng" className={`${styles.dialogClose} flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[6px] bg-[var(--surface-primary)] text-[var(--accent-hover)]`}>×</button>
      </div>
      <p className="mt-2 text-[12px] leading-4 text-[var(--text-muted)]">Dữ liệu mô phỏng · PawCare Studio</p>
      <div className="mt-5 text-[14px] leading-5">{children}</div>
    </dialog>
  );
}
