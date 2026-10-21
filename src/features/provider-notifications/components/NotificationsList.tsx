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
    <h3>{total === 0 ? "Chưa có thông báo" : "Không có thông báo khớp bộ lọc"}</h3>
    <p>{total === 0 ? "Bạn chưa có thông báo tại PawCare Studio trong dữ liệu mô phỏng này." : "Chọn Tất cả để xem lại thông báo của bạn tại cơ sở."}</p>
    {total > 0 && <button type="button" className={styles.softButton} onClick={onClear}>Xóa bộ lọc</button>}
  </div>;
  return <ul className={styles.list} aria-label="Danh sách thông báo của bạn tại PawCare Studio">
    {notifications.map((item) => <li key={item.id} className={`${styles.row} ${item.readAt === null ? styles.unread : styles.read}`}>
      <NotificationIcon kind={item.kind} />
      <div className={styles.message}>
        <div className={styles.messageHeading}><h3>{item.title}</h3><span className={styles.readBadge}>
          {item.readAt === null ? <Circle aria-hidden="true" size={8} fill="currentColor" /> : <Check aria-hidden="true" size={13} />}
          {item.readAt === null ? "Chưa đọc" : "Đã đọc"}
        </span></div>
        <p className={styles.body}>{item.body}</p>
        <time dateTime={item.createdAt}>{formatNotificationDateTime(item.createdAt)} · giờ Việt Nam</time>
      </div>
      <div className={styles.rowActions}>
        <button type="button" className={styles.outlineButton} disabled={disabled} aria-label={`Xem chi tiết ${item.id} · ${item.title}`} onClick={() => onOpen(item.id)}>{pendingId === item.id ? "Đang xử lý…" : "Xem chi tiết"}</button>
        {item.readAt === null && <button type="button" className={styles.textButton} disabled={disabled} aria-label={`Đánh dấu ${item.id} đã đọc`} onClick={() => onRead(item.id)}>Đánh dấu đã đọc</button>}
      </div>
    </li>)}
  </ul>;
}
