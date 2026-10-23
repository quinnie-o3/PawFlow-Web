import { CheckCheck } from "lucide-react";
import type { NotificationFilter } from "../types";
import styles from "../notifications.module.css";

const filters: { value: NotificationFilter; label: string }[] = [{ value: "all", label: "Tất cả" }, { value: "unread", label: "Chưa đọc" }, { value: "read", label: "Đã đọc" }];

export default function NotificationsToolbar({ filter, onFilter, unreadCount, disabled, onReadAll }: {
  filter: NotificationFilter; onFilter: (value: NotificationFilter) => void; unreadCount: number; disabled: boolean; onReadAll: () => void;
}) {
  return <div className={styles.toolbar}>
    <div className={styles.filters} role="group" aria-label="Lọc trạng thái thông báo">
      {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} disabled={disabled} onClick={() => onFilter(item.value)}>{item.label}</button>)}
    </div>
    <button className={styles.outlineButton} type="button" disabled={disabled || unreadCount === 0} onClick={onReadAll}>
      <CheckCheck aria-hidden="true" size={18} />Đánh dấu tất cả của tôi tại cơ sở là đã đọc
    </button>
    <p className={styles.scopeHint}>Áp dụng toàn bộ thông báo của bạn tại PawCare Studio, kể cả thông báo ngoài bộ lọc đang chọn.</p>
  </div>;
}
