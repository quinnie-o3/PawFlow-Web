import type { ReactNode } from "react";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { vi } from "@/lib/locale";
export const metadata = { title: vi.auth.demo.title, description: vi.auth.demo.description };
export default function Layout({ children }: { children: ReactNode }) { return <AuthPageLayout>{children}</AuthPageLayout>; }
