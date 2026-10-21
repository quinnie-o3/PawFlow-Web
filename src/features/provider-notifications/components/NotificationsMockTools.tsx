import { formatNotificationDateTime } from "../notificationLogic";
import { notificationsMockNow } from "../data/providerNotificationsMock";
import styles from "../notifications.module.css";

export default function NotificationsMockTools({ disabled, failNextUpdate, onFailNextUpdate, onLoad }: {
  disabled: boolean; failNextUpdate: boolean; onFailNextUpdate: (value: boolean) => void;
  onLoad: (options: { empty?: boolean; longContent?: boolean; simulateFailure?: boolean }) => void;
}) {
  return <details className={styles.mockTools}>
    <summary>Dữ liệu mô phỏng và các trạng thái thử</summary>
    <p>Đồng hồ mô phỏng: {formatNotificationDateTime(notificationsMockNow)} · Asia/Ho_Chi_Minh. Mock riêng của Thông báo; chưa có API hoặc đồng bộ với module khác. Trạng thái đọc mất khi tải lại hoặc rời trang. Badge chuông Header chưa đồng bộ.</p>
    <label className={styles.checkboxLabel}><input type="checkbox" checked={failNextUpdate} disabled={disabled} onChange={(event) => onFailNextUpdate(event.target.checked)} />Mô phỏng lỗi mở/cập nhật tiếp theo (một lần)</label>
    <div className={styles.scenarios}>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({ simulateFailure: true })}>Thử lỗi tải</button>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({ empty: true })}>Thử danh sách rỗng</button>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({ longContent: true })}>Thử nội dung dài</button>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({})}>Khôi phục mẫu</button>
    </div>
  </details>;
}
