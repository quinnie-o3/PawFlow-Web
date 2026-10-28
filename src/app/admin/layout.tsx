import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import AdminShell from "@/features/admin-shell/components/AdminShell";

const adminFont = Be_Vietnam_Pro({ variable: "--font-be-vietnam-pro", subsets: ["latin", "vietnamese"], weight: ["400", "600", "700"], display: "swap" });

export const metadata: Metadata = { title: "PawFlow Admin · Giao diện mô phỏng", description: "Khu vực Admin với dữ liệu mẫu chỉ đọc." };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={adminFont.variable}><AdminShell>{children}</AdminShell></div>;
}
