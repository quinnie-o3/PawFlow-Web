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
  title: "PawFlow Staff · Lịch hẹn",
  description: "Khu vực lịch hẹn Staff với thao tác mô phỏng trong phiên.",
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <div className={staffFont.variable}><StaffShell>{children}</StaffShell></div>;
}
