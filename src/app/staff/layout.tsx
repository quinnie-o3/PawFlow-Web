import { vi } from "@/lib/locale";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import StaffShell from "@/features/staff-shell/components/StaffShell";

const staffFont = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: vi.staff.metadata.title,
  description: vi.staff.metadata.description,
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <div className={staffFont.variable}><StaffShell>{children}</StaffShell></div>;
}
