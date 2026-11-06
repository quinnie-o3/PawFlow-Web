"use client";
import { vi, formatMessageParts } from "@/lib/locale";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLoginCustomer } from "@/features/auth/hooks/useLoginCustomer";
import { validateLogin, focusFirstAuthError } from "@/features/auth/validation";
import { AuthRequestError } from "@/features/auth/services/authError";
import type { AuthFieldErrors } from "@/features/auth/types";
import AuthInput from "./AuthInput";
import AuthFeedback from "./AuthFeedback";
import ForgotPasswordDialog from "./ForgotPasswordDialog";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const request = useLoginCustomer();
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [forgotOpen, setForgotOpen] = useState(false);
  const [email, setEmail] = useState("");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.isSubmitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = { email: String(data.get("email") ?? "").trim().toLowerCase(), password: String(data.get("password") ?? "") };
    const nextErrors = validateLogin(payload);
    setErrors(nextErrors);
    request.clearError();
    if (Object.keys(nextErrors).length) { focusFirstAuthError(form, nextErrors); return; }
    try {
      const result = await request.submitLogin(payload);
      if (result?.authenticated) router.push("/dashboard");
    } catch (error) {
      const fields = error instanceof AuthRequestError ? error.fieldErrors : {};
      setErrors(fields);
      focusFirstAuthError(form, fields);
    }
  }
  return <>
    <form noValidate onSubmit={handleSubmit} onChange={() => { setErrors({}); request.clearError(); }} aria-busy={request.isSubmitting} className="flex h-full w-full flex-col justify-between gap-6">
      <div>
        <div className="relative">
          <h1 className="pr-12 text-[clamp(26px,2.23vw,32px)] font-bold leading-[48px] text-[var(--accent-hover)]">{vi.auth.login.title}</h1>
          <Image aria-hidden="true" src="/union.png" alt="" width={54} height={47} className="absolute right-0 top-0 h-[47px] w-[54px] object-contain" priority />
        </div>
        <p className="mt-[15px] text-[16px] leading-[22px] text-[var(--text-secondary)]">{vi.auth.login.description}</p>
        {params.get("registered") === "1" && <AuthFeedback success={vi.auth.register.loginAfterSuccess} />}
      </div>
      <div>
        <fieldset disabled={request.isSubmitting} className="space-y-2.5">
          <AuthInput id="email" name="email" label="Email" type="email" placeholder={vi.auth.login.emailPlaceholder} autoComplete="email" required error={errors.email} onChange={(e) => setEmail(e.target.value)} />
          <AuthInput id="password" name="password" label={vi.common.fields.password} type="password" placeholder={vi.auth.login.passwordPlaceholder} autoComplete="current-password" required error={errors.password} />
        </fieldset>
        <button type="button" disabled={request.isSubmitting} onClick={() => setForgotOpen(true)} className="ml-auto block text-right text-[13px] text-[var(--accent-hover)] underline disabled:opacity-60">{vi.auth.login.forgotPassword}</button>
      </div>
      <div className="space-y-3 text-center">
        <button type="submit" disabled={request.isSubmitting} className="min-h-11 w-full rounded-[5px] bg-[var(--accent-hover)] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-70">{request.isSubmitting ? vi.auth.login.submitting : vi.auth.login.submit}</button>
        <AuthFeedback error={request.error || (Object.keys(errors).length ? vi.auth.validation.checkFields : null)} />
        <p className="text-[16px] leading-[22px] text-[var(--text-secondary)]">{formatMessageParts(vi.auth.login.registerPrompt, { registerLink: <Link key="register" href="/register" className="underline">{vi.auth.login.registerNow}</Link> })}</p>
      </div>
    </form>
    {forgotOpen && <ForgotPasswordDialog initialEmail={email} onClose={() => setForgotOpen(false)} />}
  </>;
}
