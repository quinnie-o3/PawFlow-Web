import { vi, formatMessage } from "@/lib/locale";
import { Bell, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Check, Circle, FileCheck, Star } from "lucide-react";
import { formatNotificationDateTime } from "../notificationLogic";
import type { NotificationKind, ProviderNotification } from "../types";
import styles from "../notifications.module.css";

const kindIcons = { newBooking: CalendarPlus, upcomingBooking: CalendarClock, bookingCancelled: CalendarX, newReview: Star, profileApproved: FileCheck, bookingCompleted: CalendarCheck };

export function NotificationIcon({ kind }: { kind: NotificationKind }) {
  const Icon = kindIcons[kind];
  return <span className={`${styles.categoryIcon} ${styles[kind]}`}><Icon aria-hidden="true" focusable="false" size={22} strokeWidth={2} /></span>;
}

export default function NotificationsList({ notifications, total, disabled, pendingId, onOpen, onRead, onClear }: {
  notifications: ProviderNotification[]; total: number; disabled: boolean; pendingId?: string; onOpen: (id: string) => void; onRead: (id: string) => void; onClear: () => void;
}) {
  if (notifications.length === 0) return <div className={styles.empty}>
    <Bell aria-hidden="true" size={32} />
    <h3>{total === 0 ? vi.provider.notifications.list.emptyTitle : vi.provider.notifications.list.noResultsTitle}</h3>
    <p>{total === 0 ? formatMessage(vi.provider.notifications.list.emptyDescription, { facilityName: "PawCare Studio" }) : vi.provider.notifications.list.noResultsDescription}</p>
    {total > 0 && <button type="button" className={styles.softButton} onClick={onClear}>{vi.provider.notifications.list.clearFilters}</button>}
  </div>;
  return <ul className={styles.list} aria-label={formatMessage(vi.provider.notifications.list.label, { facilityName: "PawCare Studio" })}>
    {notifications.map((item) => <li key={item.id} className={`${styles.row} ${item.readAt === null ? styles.unread : styles.read}`}>
      <NotificationIcon kind={item.kind} />
      <div className={styles.message}>
        <div className={styles.messageHeading}><h3>{item.title}</h3><span className={styles.readBadge}>
          {item.readAt === null ? <Circle aria-hidden="true" size={8} fill="currentColor" /> : <Check aria-hidden="true" size={13} />}
          {item.readAt === null ? vi.provider.notifications.status.unread : vi.provider.notifications.status.read}
        </span></div>
        <p className={styles.body}>{item.body}</p>
        <time dateTime={item.createdAt}>{formatMessage(vi.provider.notifications.list.dateTime, { dateTime: formatNotificationDateTime(item.createdAt) })}</time>
      </div>
      <div className={styles.rowActions}>
        <button type="button" className={styles.outlineButton} disabled={disabled} aria-label={formatMessage(vi.provider.notifications.list.detailLabel, { notificationId: item.id, title: item.title })} onClick={() => onOpen(item.id)}>{pendingId === item.id ? vi.provider.notifications.list.processing : vi.provider.notifications.list.details}</button>
        {item.readAt === null && <button type="button" className={styles.textButton} disabled={disabled} aria-label={formatMessage(vi.provider.notifications.list.markReadLabel, { notificationId: item.id })} onClick={() => onRead(item.id)}>{vi.provider.notifications.list.markRead}</button>}
      </div>
    </li>)}
  </ul>;
}
