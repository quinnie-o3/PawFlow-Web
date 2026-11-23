"use client";

import { vi, formatMessage } from "@/lib/locale";
import { unreadCount } from "../notifications/model";
import { useCustomerInbox } from "./CustomerInboxProvider";
import styles from "./inbox.module.css";

export default function UnreadBadge() {
  const { state } = useCustomerInbox();
  if (state.status !== "ready") return null;
  const count = unreadCount(state.items);
  return <span className={styles.badge} aria-label={formatMessage(vi.customerInbox.badgeLabel, { count })}>{count}</span>;
}
