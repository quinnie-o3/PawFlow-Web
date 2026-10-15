import Image from "next/image";
import styles from "../services.module.css";

export default function ServiceStatusBadge({ active }: { active: boolean }) {
  return <span className={`${styles.badge} ${active ? styles.visible : styles.hidden}`}>
    <Image src={active ? "/services/status-visible.svg" : "/services/status-hidden.svg"} alt="" width={7} height={7} />
    {active ? "Hiển thị" : "Tạm ẩn"}
  </span>;
}
