import { vi, formatMessage } from "@/lib/locale";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { Check } from "lucide-react";
import { notificationsMockFacility, notificationsMockOwner } from "../data/providerNotificationsMock";
import { formatNotificationDateTime } from "../notificationLogic";
import type { ProviderNotification } from "../types";
import { NotificationIcon } from "./NotificationsList";
import styles from "../notifications.module.css";

export default function NotificationDetailsDialog({ notification, onClose }: { notification: ProviderNotification; onClose: () => void }) {
  return <DashboardDialog title={formatMessage(vi.provider.notifications.details.title, { notificationId: notification.id })} onClose={onClose}>
    <div className={styles.details}>
      <div className={styles.detailHeading}><NotificationIcon kind={notification.kind} /><h3>{notification.title}</h3></div>
      <span className={styles.readBadge}><Check aria-hidden="true" size={14} />{vi.provider.notifications.status.read}</span>
      <dl className={styles.detailFields}>
        <div><dt>{vi.provider.notifications.details.recipientLabel}</dt><dd>{formatMessage(vi.provider.notifications.details.recipient, { ownerName: notificationsMockOwner })}</dd></div>
        <div><dt>{vi.provider.notifications.details.facilityLabel}</dt><dd>{notificationsMockFacility}</dd></div>
        <div><dt>{vi.provider.notifications.details.timeLabel}</dt><dd><time dateTime={notification.createdAt}>{formatNotificationDateTime(notification.createdAt)}</time> · Asia/Ho_Chi_Minh (UTC+07:00)</dd></div>
        {notification.bookingId && <div><dt>{vi.provider.notifications.details.bookingLabel}</dt><dd>{notification.bookingId}</dd></div>}
      </dl>
      <p className={styles.detailBody}>{notification.body}</p>
      {notification.bookingId && <p className={styles.help}>{vi.provider.notifications.details.bookingHint}</p>}
      <button type="button" className={styles.softButton} onClick={onClose}>{vi.provider.notifications.details.close}</button>
    </div>
  </DashboardDialog>;
}
