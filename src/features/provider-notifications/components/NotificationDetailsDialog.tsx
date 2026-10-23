import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { Check } from "lucide-react";
import { formatNotificationDateTime } from "../notificationLogic";
import type { ProviderNotification } from "../types";
import { NotificationIcon } from "./NotificationsList";
import styles from "../notifications.module.css";

export default function NotificationDetailsDialog({ notification, onClose }: { notification: ProviderNotification; onClose: () => void }) {
  return <DashboardDialog title={`Chi tiết thông báo · ${notification.id}`} onClose={onClose}>
    <div className={styles.details}>
      <div className={styles.detailHeading}><NotificationIcon kind={notification.kind} /><h3>{notification.title}</h3></div>
      <span className={styles.readBadge}><Check aria-hidden="true" size={14} />Đã đọc</span>
      <dl className={styles.detailFields}>
        <div><dt>Người nhận</dt><dd>Dane Nguyen · Chủ cơ sở</dd></div>
        <div><dt>Cơ sở</dt><dd>PawCare Studio</dd></div>
        <div><dt>Thời gian thông báo</dt><dd><time dateTime={notification.createdAt}>{formatNotificationDateTime(notification.createdAt)}</time> · Asia/Ho_Chi_Minh (UTC+07:00)</dd></div>
        {notification.bookingId && <div><dt>Mã booking liên quan</dt><dd>{notification.bookingId}</dd></div>}
      </dl>
      <p className={styles.detailBody}>{notification.body}</p>
      {notification.bookingId && <p className={styles.help}>Mã booking được hiển thị để tham chiếu. Bản mô phỏng này chưa hỗ trợ mở booking từ thông báo.</p>}
      <button type="button" className={styles.softButton} onClick={onClose}>Đóng chi tiết</button>
    </div>
  </DashboardDialog>;
}
