"use client";

import { vi } from "@/lib/locale";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import InboxReturnLink from "@/features/customer-notifications/InboxReturnLink";
import { Info } from "lucide-react";
import CustomerHeader from "./CustomerHeader";
import CustomerSidebar from "./CustomerSidebar";
import CustomerNavigation from "./CustomerNavigation";
import styles from "../customerShell.module.css";

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
        <p className={styles.mockNotice}><Info aria-hidden="true" size={16} />
          <span>{path.startsWith("/account") ? vi.customer.shell.accountNotice : vi.customer.shell.mockNotice}</span>
        </p>
      </main>
    </div>
  </div>;
}
