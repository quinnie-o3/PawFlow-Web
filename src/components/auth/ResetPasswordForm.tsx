"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { vi } from "@/lib/locale";
import { authMockConfig } from "@/features/auth/config";
import { createMockRecoveryAdapter, getMockResetTokenState } from "@/features/auth/recovery/mockAdapter";
import type { AuthRecoveryAdapter } from "@/features/auth/recovery/types";
import { useRecoveryAction } from "@/features/auth/recovery/useRecoveryAction";
import { focusFirstAuthError } from "@/features/auth/validation";
import type { AuthFieldErrors } from "@/features/auth/types";
import AuthInput from "./AuthInput";
import AuthFeedback from "./AuthFeedback";
import AuthMockNotice, { MockTools } from "./AuthMockNotice";
import ForgotPasswordDialog from "./ForgotPasswordDialog";
import styles from "./auth.module.css";

export default function ResetPasswordForm({ adapter }: { adapter?: AuthRecoveryAdapter }) {
  const params = useSearchParams();
  const tokenState = getMockResetTokenState(params.getAll("token"));
  const [recovery] = useState(() => adapter ?? createMockRecoveryAdapter());
  const action = useRecoveryAction();
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [done, setDone] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    if (tokenState !== "valid") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const next: AuthFieldErrors = {};
    const length = Array.from(password).length;
    if (length < authMockConfig.passwordMinLength || length > authMockConfig.passwordMaxLength) next.password = vi.auth.reset.passwordPolicy;
    if (password !== data.get("confirmPassword")) next.confirmPassword = vi.auth.register.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length) { focusFirstAuthError(form, next); return; }
    if (await action.run((signal, fail) => recovery.reset(params.get("token") ?? "", password, signal, fail))) {
      form.reset();
      setDone(true);
    }
  }
  return <div className={styles.form}>
    <h1 className={styles.title}>{vi.auth.reset.title}</h1>
    <p className={styles.copy}>{vi.auth.reset.description}</p>
    <AuthMockNotice />
    {tokenState !== "valid" ? <><AuthFeedback error={vi.auth.reset.tokenStates[tokenState]} /><button className={styles.primary} onClick={() => setForgotOpen(true)}>{vi.auth.reset.newRequest}</button></> : done ? <AuthFeedback success={vi.auth.reset.success} /> : <form noValidate onSubmit={submit} onChange={() => { setErrors({}); action.clearError(); }} className={styles.form} aria-busy={action.pending}>
      <fieldset disabled={action.pending} className="space-y-3">
        <AuthInput id="reset-password" name="password" label={vi.common.fields.password} type="password" autoComplete="new-password" error={errors.password} hint={vi.auth.reset.passwordPolicy} required />
        <AuthInput id="reset-confirm" name="confirmPassword" label={vi.auth.register.confirmPassword} type="password" autoComplete="new-password" error={errors.confirmPassword} required />
      </fieldset>
      <button className={styles.primary} disabled={action.pending}>{action.pending ? vi.auth.reset.pending : vi.auth.reset.submit}</button>
      <AuthFeedback error={action.error || (Object.keys(errors).length ? vi.auth.validation.checkFields : null)} />
      <MockTools pending={action.pending} failNext={action.failNext} onChange={action.setFailNext} />
    </form>}
    <Link className={styles.link} href="/login">{vi.auth.mock.backToLogin}</Link>
    {forgotOpen && <ForgotPasswordDialog initialEmail="" onClose={() => setForgotOpen(false)} />}
  </div>;
}
