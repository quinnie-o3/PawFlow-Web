import { Circle } from "lucide-react";
import styles from "../services.module.css";

export default function ServiceStatusBadge({ active }: { active: boolean }) {
  return <span className={`${styles.badge} ${active ? styles.visible : styles.hidden}`}>
    <Circle aria-hidden="true" focusable="false" size={7} strokeWidth={2} fill="currentColor" />
    {active ? "Hiển thị" : "Tạm ẩn"}
  </span>;
}
