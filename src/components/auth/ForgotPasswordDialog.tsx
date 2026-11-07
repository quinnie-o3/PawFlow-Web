"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { vi } from "@/lib/locale";
import { authMockConfig } from "@/features/auth/config";
import { createMockRecoveryAdapter } from "@/features/auth/recovery/mockAdapter";
import type { AuthRecoveryAdapter } from "@/features/auth/recovery/types";
import { useRecoveryAction } from "@/features/auth/recovery/useRecoveryAction";
import { validateEmail } from "@/features/auth/validation";
import AuthInput from "./AuthInput";
import AuthFeedback from "./AuthFeedback";
import AuthMockNotice, { MockTools } from "./AuthMockNotice";
import styles from "./auth.module.css";

export default function ForgotPasswordDialog({ initialEmail, onClose, adapter }: { initialEmail: string; onClose: () => void; adapter?: AuthRecoveryAdapter }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [recovery] = useState(() => adapter ?? createMockRecoveryAdapter());
  const action = useRecoveryAction();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    const trigger = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    const invalid = validateEmail(email);
    setError(invalid);
    if (invalid) { form.querySelector("input")?.focus(); return; }
    if (await action.run((signal, fail) => recovery.forgot(email, signal, fail))) setDone(true);
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="forgot-title" aria-describedby="forgot-copy" onCancel={(event) => { event.preventDefault(); if (!action.pending) onClose(); }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), a[href], summary, [tabindex="0"]')).filter((node) => {
      const closedDetails = node.closest("details:not([open])");
      // Closed details can still report rectangles for their hidden controls.
      return node.getClientRects().length > 0 && (!closedDetails || closedDetails.querySelector("summary")?.contains(node));
    });
    const first = controls[0];
    const last = controls[controls.length - 1];
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }} onClick={(event) => { const r = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && !action.pending && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) onClose(); }}>
    <div className={styles.form}>
      <h2 id="forgot-title" className={styles.dialogTitle}>{vi.auth.forgot.title}</h2>
      <p id="forgot-copy" className={styles.copy}>{vi.auth.forgot.description}</p>
      <AuthMockNotice />
      {!done ? <form noValidate onSubmit={submit} aria-busy={action.pending} className={styles.form}>
        <AuthInput id="forgot-email" name="email" label="Email" type="email" autoComplete="email" defaultValue={initialEmail} error={error} disabled={action.pending} onChange={() => { setError(undefined); action.clearError(); }} />
        <button className={styles.primary} disabled={action.pending}>{action.pending ? vi.auth.forgot.pending : vi.auth.forgot.submit}</button>
        <AuthFeedback error={action.error} />
      </form> : <><AuthFeedback success={vi.auth.forgot.success} /><Link className={styles.primary} href={`/reset-password?token=${authMockConfig.resetToken}`}>{vi.auth.forgot.openDemoReset}</Link></>}
      <button className={styles.secondary} onClick={onClose} disabled={action.pending}>{vi.auth.forgot.close}</button>
      {!done && <MockTools pending={action.pending} failNext={action.failNext} onChange={action.setFailNext} />}
    </div>
  </dialog>;
}
