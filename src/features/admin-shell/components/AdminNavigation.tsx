"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation } from "../adminNavigation";
import styles from "../adminShell.module.css";

export default function AdminNavigation({ label, compact = false, onNavigate }: { label: string; compact?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label={label} className={compact ? styles.topNavigation : styles.navigation}>
    {adminNavigation.map(({ href, label, icon: Icon }) => <Link href={href} key={href} prefetch={false} aria-current={pathname === href ? "page" : undefined} onClick={onNavigate}>
      {!compact && <Icon size={22} aria-hidden="true" />}<span>{label}</span>
    </Link>)}
  </nav>;
}
