import { vi } from "@/lib/locale";
import styles from "./feedback.module.css";

export default function Skeleton({ label = vi.sharedUi.loading, rows = 3 }: { label?: string; rows?: number }) {
  return <div role="status" aria-label={label} className={styles.skeletonGroup}>
    <span className={styles.srOnly}>{label}</span>
    {Array.from({ length: rows }, (_, index) => <div key={index} aria-hidden="true" className={styles.skeleton} />)}
  </div>;
}
