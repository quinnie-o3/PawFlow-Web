"use client";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ClipboardEvent } from "react";
import { vi, formatMessage } from "@/lib/locale";
import { authMockConfig, authUiPolicy } from "@/features/auth/config";
import { createMockRecoveryAdapter } from "@/features/auth/recovery/mockAdapter";
import type { AuthRecoveryAdapter } from "@/features/auth/recovery/types";
import { useRecoveryAction } from "@/features/auth/recovery/useRecoveryAction";
import AuthFeedback from "./AuthFeedback";
import AuthMockNotice, { MockTools } from "./AuthMockNotice";
import styles from "./auth.module.css";

export default function VerifyEmailForm() {
  const params = useSearchParams();
  if (!authUiPolicy.verificationRequired && params.get("demo") !== "1") {
    return <div className={styles.form}><h1 className={styles.title}>{vi.auth.verification.disabledTitle}</h1><p className={styles.copy}>{vi.auth.verification.disabledBody}</p><Link className={styles.primary} href="/register">{vi.auth.register.submit}</Link><Link className={styles.link} href="/login">{vi.auth.mock.backToLogin}</Link><Link className={styles.link} href="/register/verify-email?demo=1">{vi.auth.verification.preview}</Link></div>;
  }
  return <VerificationDemo />;
}

export function VerificationDemo({ adapter }: { adapter?: AuthRecoveryAdapter }) {
  const [recovery] = useState(() => adapter ?? createMockRecoveryAdapter());
  const action = useRecoveryAction();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);
  const [operation, setOperation] = useState<"verify" | "resend">("verify");
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(id); }, []);
  const { expiresAt, resendAt } = recovery.verificationTiming();
  const remaining = Math.max(0, Math.ceil((expiresAt - clock) / 1000));
  const cooldown = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  function fillCode(value: string, start: number) {
    const clean = value.replace(/\D/g, "").slice(0, 6 - start);
    setDigits((previous) => { const next = [...previous]; if (!clean) next[start] = ""; else [...clean].forEach((digit, offset) => { next[start + offset] = digit; }); return next; });
    setError(undefined); action.clearError(); setResent(false);
    if (clean) inputs.current[Math.min(5, start + clean.length)]?.focus();
  }
  function paste(event: ClipboardEvent<HTMLInputElement>, index: number) { event.preventDefault(); fillCode(event.clipboardData.getData("text"), index); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    if (digits.some((digit) => !/^\d$/.test(digit))) { setError(vi.auth.verification.codeRequired); inputs.current[digits.findIndex((digit) => !digit)]?.focus(); return; }
    setOperation("verify"); setResent(false);
    if (await action.run((signal, fail) => recovery.verify(digits.join(""), signal, fail))) { setDigits(Array(6).fill("")); setDone(true); }
  }
  async function resend() {
    if (action.pending) return;
    setOperation("resend"); setError(undefined);
    if (await action.run((signal, fail) => recovery.resend(signal, fail))) { setClock(Date.now()); setResent(true); setDigits(Array(6).fill("")); inputs.current[0]?.focus(); }
  }
  return <div className={styles.form}>
    <div className="flex items-center justify-center gap-4"><h1 className={`${styles.title} ${styles.center}`}>{vi.auth.verification.title}</h1><Image aria-hidden="true" alt="" src="/auth/verification-paw.svg" width={54} height={47} className="shrink-0 rotate-90" /></div>
    <AuthMockNotice />
    {done ? <AuthFeedback success={vi.auth.verification.success} /> : <form noValidate className={styles.form} onSubmit={submit} aria-busy={action.pending}>
      <p className={`${styles.copy} ${styles.center}`}>{vi.auth.verification.demoDescription}</p>
      <fieldset disabled={action.pending} aria-label={vi.auth.verification.codeLabel} aria-describedby="verification-feedback" className={styles.otp}>
        {digits.map((digit, i) => <input key={i} ref={(node) => { inputs.current[i] = node; }} aria-label={formatMessage(vi.auth.verification.digit, { index: i + 1 })} aria-invalid={error || action.error ? true : undefined} aria-describedby="verification-feedback" inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} value={digit}
          onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const input = event.nativeEvent as InputEvent;
            // A typed digit replaces this cell; paste/autofill can still populate several cells.
            fillCode(input.inputType === "insertText" && input.data?.length === 1 ? input.data : event.target.value, i);
          }} onPaste={(event) => paste(event, i)} onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && i > 0) { event.preventDefault(); inputs.current[i - 1]?.focus(); }
            if (event.key === "ArrowLeft") { event.preventDefault(); inputs.current[Math.max(0, i - 1)]?.focus(); }
            if (event.key === "ArrowRight") { event.preventDefault(); inputs.current[Math.min(5, i + 1)]?.focus(); }
          }} />)}
      </fieldset>
      <p className={`${styles.copy} ${styles.center}`}>{remaining ? formatMessage(vi.auth.verification.remaining, { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` }) : vi.auth.verification.expired}</p>
      <button className={styles.link} type="button" onClick={resend} disabled={action.pending || cooldown > 0}>{action.pending && operation === "resend" ? vi.auth.verification.resending : cooldown ? formatMessage(vi.auth.verification.cooldown, { seconds: cooldown }) : vi.auth.verification.resend}</button>
      <div id="verification-feedback"><AuthFeedback error={error ?? action.error} success={resent ? vi.auth.verification.resent : null} /></div>
      <Image aria-hidden="true" alt="" src="/auth/verification-steps.svg" width={44} height={12} className="mx-auto" />
      <button className={styles.primary} disabled={action.pending}>{action.pending && operation === "verify" ? vi.auth.verification.pending : vi.auth.verification.submit}</button>
      <MockTools pending={action.pending} failNext={action.failNext} onChange={action.setFailNext} />
      <p className={styles.tools}>{formatMessage(vi.auth.verification.demoValues, { code: authMockConfig.verificationCode, ttl: authMockConfig.verificationLifetimeMs / 1000, cooldown: authMockConfig.resendCooldownMs / 1000 })}</p>
    </form>}
    <Link className={`${styles.link} ${styles.center}`} href="/login">{vi.auth.mock.backToLogin}</Link>
  </div>;
}
