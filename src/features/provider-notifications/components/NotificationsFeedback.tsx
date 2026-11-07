import { vi } from "@/lib/locale";
import type { NotificationFeedback } from "../types";
import styles from "../notifications.module.css";

export default function NotificationsFeedback({ feedback, canRetry, onRetry }: { feedback: NotificationFeedback; canRetry: boolean; onRetry: () => void }) {
  return <div className={`${styles.feedback} ${feedback.outcome === "error" ? styles.error : styles.success}`}>
    <p role={feedback.outcome === "error" ? "alert" : "status"}>{feedback.message}</p>
    {canRetry && <button type="button" className={styles.outlineButton} onClick={onRetry}>{vi.provider.notifications.feedback.retry}</button>}
  </div>;
}
