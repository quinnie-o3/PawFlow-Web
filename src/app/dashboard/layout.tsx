import type { ReactNode } from "react";
import Image from "next/image";
import { Be_Vietnam_Pro } from "next/font/google";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import styles from "@/features/provider-dashboard/dashboard.module.css";

const dashboardFont = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${dashboardFont.variable} ${styles.surface} flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--text-primary)]`}>
      <Header provider />
      <div className="relative isolate flex min-h-0 min-w-0 flex-1 overflow-clip px-4 py-4 sm:px-6 lg:py-6 xl:px-8">
        <Image aria-hidden="true" alt="" src="/dashboard/arc-upper-left.svg" width={500} height={510} className={`${styles.backdrop} pointer-events-none absolute left-[-85px] top-[-210px] z-[-1]`} />
        <Image aria-hidden="true" alt="" src="/dashboard/arc-upper-right.svg" width={610} height={590} className={`${styles.backdrop} pointer-events-none absolute right-[-170px] top-[-370px] z-[-1]`} />
        <Image aria-hidden="true" alt="" src="/dashboard/arc-lower-right.svg" width={560} height={570} className={`${styles.backdrop} pointer-events-none absolute bottom-[-293px] right-[-190px] z-[-1]`} />
        <Image aria-hidden="true" alt="" src="/dashboard/dots-left.svg" width={84} height={84} className="pointer-events-none absolute left-[42px] top-[190px] z-[-1] hidden xl:block" />
        <Image aria-hidden="true" alt="" src="/dashboard/dots-lower-center.svg" width={168} height={36} className="pointer-events-none absolute bottom-[-6px] left-1/2 z-[-1] hidden -translate-x-1/2 xl:block" />
        <div className="mx-auto flex min-h-0 min-w-0 w-full items-stretch gap-5 rounded-[35px] bg-[#f6f8fa] p-5">
          <div className="hidden min-h-0 w-[285px] min-w-0 shrink-0 lg:flex"><Sidebar provider /></div>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain" aria-label="Nội dung dashboard">{children}</main>
        </div>
      </div>
    </div>
  );
}
