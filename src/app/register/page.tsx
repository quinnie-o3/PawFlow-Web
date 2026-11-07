import { vi } from "@/lib/locale";
import RegisterForm from "@/components/auth/RegisterForm";
import RegisterSidePanel from "@/components/auth/RegisterSidePanel";

export const metadata = { title: vi.auth.register.submit, description: vi.auth.register.immediateAccess };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center overflow-x-clip bg-white py-6 lg:py-0">
      <section className="w-full" aria-label={vi.auth.register.pageLabel}>
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-0">
          <div className="min-h-[770px] rounded-[20px] bg-[var(--surface-primary)] px-6 py-8 sm:px-10 lg:px-[60px] lg:py-[40px]">
            <RegisterForm />
          </div>
          <RegisterSidePanel />
        </div>
      </section>
    </main>
  );
}
