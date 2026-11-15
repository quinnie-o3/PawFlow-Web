import { vi, formatMessage } from "@/lib/locale";
import { formatNotificationDateTime } from "../notificationLogic";
import { notificationsMockNow } from "../data/providerNotificationsMock";
import styles from "../notifications.module.css";

export default function NotificationsMockTools({ disabled, failNextUpdate, onFailNextUpdate, onLoad }: {
  disabled: boolean; failNextUpdate: boolean; onFailNextUpdate: (value: boolean) => void;
  onLoad: (options: { empty?: boolean; longContent?: boolean; simulateFailure?: boolean }) => void;
}) {
  return <details className={styles.mockTools}>
    <summary>{vi.provider.notifications.mock.title}</summary>
    <p>{formatMessage(vi.provider.notifications.mock.clockDescription, { dateTime: formatNotificationDateTime(notificationsMockNow) })}</p>
    <label className={styles.checkboxLabel}><input type="checkbox" checked={failNextUpdate} disabled={disabled} onChange={(event) => onFailNextUpdate(event.target.checked)} />{vi.provider.notifications.mock.failNextUpdate}</label>
    <div className={styles.scenarios}>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({ simulateFailure: true })}>{vi.provider.notifications.mock.loadError}</button>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({ empty: true })}>{vi.provider.notifications.mock.empty}</button>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({ longContent: true })}>{vi.provider.notifications.mock.longContent}</button>
      <button type="button" className={styles.softButton} disabled={disabled} onClick={() => onLoad({})}>{vi.provider.notifications.mock.restore}</button>
    </div>
  </details>;
}
