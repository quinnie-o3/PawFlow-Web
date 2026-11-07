import type { ReactNode } from "react";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { vi } from "@/lib/locale";
export const metadata = { title: vi.auth.reset.title, description: vi.auth.reset.description };
export default function Layout({ children }: { children: ReactNode }) { return <AuthPageLayout>{children}</AuthPageLayout>; }
