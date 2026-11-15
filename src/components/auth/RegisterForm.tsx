"use client";

import { vi, formatMessage, formatMessageParts } from "@/lib/locale";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useRegisterCustomer } from "@/features/auth/hooks/useRegisterCustomer";
import { useTurnstileProtectedSubmit } from "@/features/auth/hooks/useTurnstileProtectedSubmit";
import { describeSubmitBlock } from "@/features/auth/turnstile/protectedSubmit";
import { TURNSTILE_ACTIONS } from "@/features/auth/turnstile/turnstileConfig";
import AuthInput from "./AuthInput";
import TurnstileField from "./TurnstileField";

export default function RegisterForm() {
  const router = useRouter();
  const { error, setError, isSubmitting, submitRegistration } = useRegisterCustomer();
  const turnstile = useTurnstileProtectedSubmit(TURNSTILE_ACTIONS.register);
  const isBusy = isSubmitting || turnstile.isSubmitting;
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setValidationError(vi.auth.register.passwordMismatch);
      return;
    }

    try {
      await turnstile.submit((turnstileToken) =>
        submitRegistration({
          fullName: String(formData.get("fullName") ?? ""),
          email: String(formData.get("email") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          password,
          turnstileToken,
        }),
      );
      router.push("/register/verify-email");
    } catch (submitError) {
      // Request errors are exposed by the hook; blocked submissions (no token, cooldown) are explained here.
      const blocked = describeSubmitBlock(submitError);
      if (blocked) setError(blocked);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full w-full flex-col justify-between">
      <div className="relative h-12">
        <h1 className="text-[32px] font-bold leading-[48px] text-[var(--accent-hover)]">{vi.auth.register.title}</h1>
        <Image aria-hidden="true" src="/union.png" alt="" width={54} height={47} className="absolute left-[170px] top-0 h-[47px] w-[54px] object-contain" priority />
      </div>

      <div className="space-y-1.5">
        <AuthInput id="full-name" name="fullName" label={vi.common.fields.fullName} type="text" autoComplete="name" required />
        <AuthInput id="email" name="email" label="Email" type="email" autoComplete="email" required />
        <AuthInput id="phone" name="phone" label={vi.common.fields.phone} type="tel" autoComplete="tel" required />
        <AuthInput id="password" name="password" label={vi.common.fields.password} type="password" autoComplete="new-password" required />
        <AuthInput id="confirm-password" name="confirmPassword" label={vi.auth.register.confirmPassword} type="password" autoComplete="new-password" required />
      </div>

      <div className="space-y-2">
        <TurnstileField turnstile={turnstile} />
        <div aria-label={vi.auth.register.stepLabel} className="flex justify-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <span aria-hidden="true" className="h-2 w-2 rounded-full border border-[var(--border)] bg-[var(--surface)]" />
        </div>
        <button type="submit" disabled={!turnstile.canSubmit || isBusy} aria-disabled={!turnstile.canSubmit || isBusy} className="h-11 w-full rounded-[5px] bg-[var(--accent-hover)] px-[30px] py-[10px] text-[16px] font-semibold leading-[22px] text-[var(--text-on-primary)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70">
          {isBusy ? vi.auth.register.submitting : turnstile.cooldownSeconds > 0 ? formatMessage(vi.auth.turnstile.retryIn, { seconds: turnstile.cooldownSeconds }) : vi.auth.register.continue}
        </button>
        <p aria-live="polite" className="min-h-[18px] text-center text-[12px] leading-[18px] text-red-600">{validationError ?? error}</p>
        <p className="text-center text-[16px] leading-[22px] text-[var(--text-secondary)]">{formatMessageParts(vi.auth.register.loginPrompt, { loginLink: <Link key="login" href="/login" className="hover:text-[var(--accent-hover)] hover:underline">{vi.auth.login.submit}</Link> })}</p>
        <div className="flex items-center gap-5 py-0.5 text-[12px] leading-[18px] text-[var(--text-disabled)]"><span className="h-px flex-1 bg-[var(--border)]" />{vi.auth.register.or}<span className="h-px flex-1 bg-[var(--border)]" /></div>
        <button type="button" className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[5px] border bg-[var(--surface)] px-[30px] py-[10px] text-[15px] font-bold leading-[22px] text-[var(--text-secondary)]">
          {vi.auth.register.google}</button>
      </div>
    </form>
  );
}
