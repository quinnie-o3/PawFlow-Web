"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "../adminShell.module.css";

export default function AdminMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // A fresh scroll container keeps the Admin banner visible when the route changes.
  return <main key={pathname} id="admin-main" tabIndex={-1} className={styles.main} aria-label="Nội dung Admin"><div className={styles.adminTab}>DÀNH CHO ADMIN</div>{children}</main>;
}
