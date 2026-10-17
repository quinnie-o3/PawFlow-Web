"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useRegisterCustomer } from "@/features/auth/hooks/useRegisterCustomer";
import AuthInput from "./AuthInput";

export default function RegisterForm() {
  const router = useRouter();
  const { error, isSubmitting, submitRegistration } = useRegisterCustomer();
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setValidationError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      await submitRegistration({
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        password,
      });
      router.push("/register/verify-email");
    } catch {
      // The hook exposes the request error to the accessible form error message below.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full w-full flex-col justify-between">
      <div className="relative h-12">
        <h1 className="text-[32px] font-bold leading-[48px] text-[var(--accent-hover)]">ĐĂNG KÝ</h1>
        <Image aria-hidden="true" src="/union.png" alt="" width={54} height={47} className="absolute left-[170px] top-0 h-[47px] w-[54px] object-contain" priority />
      </div>

      <div className="space-y-1.5">
        <AuthInput id="full-name" name="fullName" label="Họ và tên" type="text" autoComplete="name" required />
        <AuthInput id="email" name="email" label="Email" type="email" autoComplete="email" required />
        <AuthInput id="phone" name="phone" label="Số điện thoại" type="tel" autoComplete="tel" required />
        <AuthInput id="password" name="password" label="Mật khẩu" type="password" autoComplete="new-password" required />
        <AuthInput id="confirm-password" name="confirmPassword" label="Nhập lại mật khẩu" type="password" autoComplete="new-password" required />
      </div>

      <div className="space-y-2">
        <div aria-label="Bước 1 trên 2" className="flex justify-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <span aria-hidden="true" className="h-2 w-2 rounded-full border border-[var(--border)] bg-[var(--surface)]" />
        </div>
        <button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-[5px] bg-[var(--accent-hover)] px-[30px] py-[10px] text-[16px] font-semibold leading-[22px] text-[var(--text-on-primary)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? "Đang đăng ký..." : "Tiếp tục"}
        </button>
        <p aria-live="polite" className="min-h-[18px] text-center text-[12px] leading-[18px] text-red-600">{validationError ?? error}</p>
        <p className="text-center text-[16px] leading-[22px] text-[var(--text-secondary)]">Đã có tài khoản? <Link href="/login" className="hover:text-[var(--accent-hover)] hover:underline">Đăng nhập</Link></p>
        <div className="flex items-center gap-5 py-0.5 text-[12px] leading-[18px] text-[var(--text-disabled)]"><span className="h-px flex-1 bg-[var(--border)]" />Hoặc<span className="h-px flex-1 bg-[var(--border)]" /></div>
        <button type="button" className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[5px] border bg-[var(--surface)] px-[30px] py-[10px] text-[15px] font-bold leading-[22px] text-[var(--text-secondary)]">
          Đăng ký bằng Google
        </button>
      </div>
    </form>
  );
}
