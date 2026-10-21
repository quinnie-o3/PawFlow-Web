import LoginForm from "@/components/auth/LoginForm";
import LoginSidePanel from "@/components/auth/LoginSidePanel";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center overflow-x-clip bg-white py-6 lg:py-0">
      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-0" aria-label="Đăng nhập PawFlow">
        <div className="h-[770px] rounded-[20px] bg-[var(--surface-primary)] p-6 sm:p-10 lg:h-[min(770px,calc(100vh-48px))] lg:p-[60px]">
          <LoginForm />
        </div>
        <LoginSidePanel />
      </section>
    </main>
  );
}
