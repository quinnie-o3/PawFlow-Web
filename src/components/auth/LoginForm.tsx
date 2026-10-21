"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useLoginCustomer } from "@/features/auth/hooks/useLoginCustomer";
import AuthInput from "./AuthInput";

export default function LoginForm() {
  const router = useRouter();
  const { error, isSubmitting, submitLogin } = useLoginCustomer();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await submitLogin({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      router.push("/dashboard");
    } catch {
      // The hook exposes the request error to the accessible form error message below.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full w-full flex-col justify-between">
      <div>
        <div className="relative">
          <h1 className="pr-12 text-[clamp(26px,2.23vw,32px)] font-bold leading-[48px] text-[var(--accent-hover)]">CHÀO MỪNG TRỞ LẠI</h1>
          <Image aria-hidden="true" src="/union.png" alt="" width={54} height={47} className="absolute right-[60px] top-0 h-[47px] w-[54px] object-contain" priority />
        </div>
        <p className="mt-[15px] max-w-[470px] text-[16px] leading-[22px] text-[var(--text-secondary)]">Đăng nhập để quản lý thú cưng, lịch hẹn và hoạt động của bạn trên PawFlow.</p>
      </div>

      <div className="w-full">
        <div className="space-y-2.5">
          <AuthInput id="email" name="email" label="Email" type="email" placeholder="Nhập địa chỉ email" autoComplete="email" required />
          <AuthInput id="password" name="password" label="Mật khẩu" type="password" placeholder="Nhập mật khẩu" autoComplete="current-password" required />
        </div>
        <div className="mt-0 flex items-center gap-[10px] text-[12px] leading-[18px]">
          <label className="flex cursor-pointer items-center gap-[10px] text-[var(--text-secondary)]">
            <input type="checkbox" className="h-[18px] w-[18px] appearance-none rounded-[2px] border bg-transparent checked:border-[var(--accent-hover)] checked:bg-[var(--accent-hover)]" />
            Ghi nhớ đăng nhập
          </label>
          <button type="button" className="ml-auto text-right text-[#001aff] hover:underline">Quên mật khẩu?</button>
        </div>
      </div>

      <div className="w-full text-center">
        <button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-[5px] bg-[var(--accent-hover)] px-[30px] py-[10px] text-[15px] font-semibold leading-[22px] text-[var(--text-on-primary)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        <p aria-live="polite" className="min-h-[18px] text-center text-[12px] leading-[18px] text-red-600">{error}</p>
        <p className="mt-2.5 text-[16px] leading-[22px] text-[var(--text-secondary)]">Chưa có tài khoản? <Link href="/register" className="hover:text-[var(--accent-hover)] hover:underline">Đăng ký ngay</Link></p>
      </div>
    </form>
  );
}
