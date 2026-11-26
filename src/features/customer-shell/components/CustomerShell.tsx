"use client";

import { vi } from "@/lib/locale";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import InboxReturnLink from "@/features/customer-notifications/InboxReturnLink";
import { resolveBookingRouteSource } from "@/features/customer-booking/liveCancel";
import { Info } from "lucide-react";
import CustomerHeader from "./CustomerHeader";
import CustomerSidebar from "./CustomerSidebar";
import CustomerNavigation from "./CustomerNavigation";
import styles from "../customerShell.module.css";

function ShellNotice({ path }: { path: string }) {
  const searchParams = useSearchParams();
  let notice: string;
  if (path.startsWith("/account")) {
    notice = vi.customer.shell.accountNotice;
  } else if (path === "/bookings" || path.startsWith("/bookings/")) {
    notice =
      resolveBookingRouteSource(searchParams) === "demo"
        ? vi.customer.shell.mockNotice
        : vi.booking.live.shellNotice;
  } else {
    notice = vi.customer.shell.mockNotice;
  }
  return (
    <p className={styles.mockNotice}>
      <Info aria-hidden="true" size={16} />
      <span>{notice}</span>
    </p>
  );
}

export default function CustomerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return <div className={styles.surface} lang="vi">
    <a href="#customer-content" className={styles.skipLink}>{vi.customer.shell.skip}</a>
    <CustomerHeader />
    <div className={styles.workspace}>
      <aside className={styles.desktopSidebar} aria-label={vi.customer.shell.accountRegion}><CustomerSidebar /></aside>
      <main id="customer-content" tabIndex={-1} className={styles.main}>
        <Suspense fallback={null}><InboxReturnLink /></Suspense>
        {path.startsWith("/account") && <CustomerNavigation />}
        {children}
        <Suspense fallback={null}><ShellNotice path={path} /></Suspense>
      </main>
    </div>
  </div>;
}
