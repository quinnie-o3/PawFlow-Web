import { vi, formatMessage } from "@/lib/locale";
import { CheckCheck } from "lucide-react";
import type { NotificationFilter } from "../types";
import styles from "../notifications.module.css";

const filters: { value: NotificationFilter; label: string }[] = [{ value: "all", label: vi.common.actions.all }, { value: "unread", label: vi.provider.notifications.status.unread }, { value: "read", label: vi.provider.notifications.status.read }];

export default function NotificationsToolbar({ filter, onFilter, unreadCount, disabled, onReadAll }: {
  filter: NotificationFilter; onFilter: (value: NotificationFilter) => void; unreadCount: number; disabled: boolean; onReadAll: () => void;
}) {
  return <div className={styles.toolbar}>
    <div className={styles.filters} role="group" aria-label={vi.provider.notifications.toolbar.filterLabel}>
      {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} disabled={disabled} onClick={() => onFilter(item.value)}>{item.label}</button>)}
    </div>
    <button className={styles.outlineButton} type="button" disabled={disabled || unreadCount === 0} onClick={onReadAll}>
      <CheckCheck aria-hidden="true" size={18} />{vi.provider.notifications.toolbar.markAllRead}
    </button>
    <p className={styles.scopeHint}>{formatMessage(vi.provider.notifications.toolbar.scopeHint, { facilityName: "PawCare Studio" })}</p>
  </div>;
}
