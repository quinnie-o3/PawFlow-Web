"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { vi } from "@/lib/locale";
import { inboxReturnHref } from "../notifications/model";
import { useCustomerInbox } from "./CustomerInboxProvider";
import styles from "./inbox.module.css";

/** A verified inbox origin remains available even if the target screen fails to load. */
export default function InboxReturnLink() {
  const path = usePathname();
  const id = useSearchParams().get("fromInbox");
  const { state } = useCustomerInbox();
  const href = inboxReturnHref(id, path, state.items);
  if (!href) return null;
  return <nav className={styles.returnBanner} data-discovery={path.startsWith("/providers/") || undefined} aria-label={vi.customerInbox.title}><Link href={href} className={styles.back}>← {vi.customerInbox.back}</Link></nav>;
}
