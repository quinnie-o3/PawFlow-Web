import type { ReactNode } from "react";
import AuthPageLayout from "@/components/auth/AuthPageLayout";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthPageLayout>{children}</AuthPageLayout>;
}
