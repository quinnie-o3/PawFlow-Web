import VerificationResend from "@/features/session/VerificationResend";
import Link from "next/link";

export default function RegistrationVerificationPage() {
  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
    <section className="w-full space-y-5 rounded-[20px] bg-[var(--surface-primary)] p-6 sm:p-10" aria-labelledby="verify-registration-title">
      <h1 id="verify-registration-title" className="text-2xl font-bold text-[var(--accent-hover)]">Kiểm tra email</h1>
      <p>Nếu email xác minh được gửi thành công, hãy mở liên kết trong hộp thư để xác minh địa chỉ của bạn.</p>
      <VerificationResend />
      <Link className="inline-block text-[var(--accent-hover)] underline" href="/login">Về trang đăng nhập</Link>
    </section>
  </main>;
}
