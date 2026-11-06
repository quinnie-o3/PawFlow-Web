"use client";

import { vi } from "@/lib/locale";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "../adminShell.module.css";

export default function AdminMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // A fresh scroll container keeps the Admin banner visible when the route changes.
  return <main key={pathname} id="admin-main" tabIndex={-1} className={styles.main} aria-label={vi.admin.shell.contentLabel}><div className={styles.adminTab}>{vi.admin.shell.roleHeading}</div>{children}</main>;
}
