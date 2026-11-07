"use client";
import { vi, formatMessageParts } from "@/lib/locale";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useRegisterCustomer } from "@/features/auth/hooks/useRegisterCustomer";
import { validateRegistration, focusFirstAuthError } from "@/features/auth/validation";
import { AuthRequestError } from "@/features/auth/services/authError";
import type { AuthFieldErrors } from "@/features/auth/types";
import AuthInput from "./AuthInput";
import AuthFeedback from "./AuthFeedback";

export default function RegisterForm() {
  const router = useRouter();
  const request = useRegisterCustomer();
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.isSubmitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = { fullName: String(data.get("fullName") ?? "").trim(), email: String(data.get("email") ?? "").trim().toLowerCase(), phone: String(data.get("phone") ?? "").trim(), password: String(data.get("password") ?? ""), confirmPassword: String(data.get("confirmPassword") ?? "") };
    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    request.clearError();
    if (Object.keys(nextErrors).length) { focusFirstAuthError(form, nextErrors); return; }
    try {
      const result = await request.submitRegistration({ fullName: values.fullName, email: values.email, password: values.password, ...(values.phone ? { phone: values.phone } : {}) });
      if (result) router.push(result.authenticated ? "/dashboard" : "/login?registered=1");
    } catch (error) {
      const fields = error instanceof AuthRequestError ? error.fieldErrors : {};
      setErrors(fields);
      focusFirstAuthError(form, fields);
    }
  }
  return <form noValidate onSubmit={handleSubmit} onChange={() => { setErrors({}); request.clearError(); }} aria-busy={request.isSubmitting} className="flex h-full w-full flex-col justify-between gap-5">
    <div className="relative">
      <h1 className="pr-14 text-[32px] font-bold leading-[48px] text-[var(--accent-hover)]">{vi.auth.register.title}</h1>
      <Image aria-hidden="true" src="/union.png" alt="" width={54} height={47} className="absolute right-0 top-0 h-[47px] w-[54px] object-contain" priority />
      <p className="mt-2 text-[14px] leading-5 text-[var(--text-secondary)]">{vi.auth.register.immediateAccess}</p>
    </div>
    <fieldset disabled={request.isSubmitting} className="space-y-1.5">
      <AuthInput id="full-name" name="fullName" label={vi.common.fields.fullName} type="text" autoComplete="name" required error={errors.fullName} />
      <AuthInput id="email" name="email" label="Email" type="email" autoComplete="email" required error={errors.email} />
      <AuthInput id="phone" name="phone" label={vi.auth.register.optionalPhone} type="tel" autoComplete="tel" error={errors.phone} />
      <AuthInput id="password" name="password" label={vi.common.fields.password} type="password" autoComplete="new-password" required error={errors.password} hint={vi.auth.validation.passwordHint} />
      <AuthInput id="confirm-password" name="confirmPassword" label={vi.auth.register.confirmPassword} type="password" autoComplete="new-password" required error={errors.confirmPassword} />
    </fieldset>
    <div className="space-y-3 text-center">
      <button type="submit" disabled={request.isSubmitting} className="min-h-11 w-full rounded-[5px] bg-[var(--accent-hover)] px-5 py-2.5 text-[16px] font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-70">{request.isSubmitting ? vi.auth.register.submitting : vi.auth.register.submit}</button>
      <AuthFeedback error={request.error || (Object.keys(errors).length ? vi.auth.validation.checkFields : null)} />
      <p className="text-[16px] leading-[22px] text-[var(--text-secondary)]">{formatMessageParts(vi.auth.register.loginPrompt, { loginLink: <Link key="login" href="/login" className="underline">{vi.auth.login.submit}</Link> })}</p>
    </div>
  </form>;
}
