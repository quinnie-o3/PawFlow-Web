import { Circle } from "lucide-react";
import { vi } from "@/lib/locale";
import type { ProviderServiceStatus } from "../types";
import styles from "../services.module.css";

export default function ServiceStatusBadge({
  status,
}: {
  status: ProviderServiceStatus;
}) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={`${styles.badge} ${isActive ? styles.visible : styles.hidden}`}
    >
      <Circle
        aria-hidden="true"
        focusable="false"
        size={7}
        strokeWidth={2}
        fill="currentColor"
      />
      {isActive
        ? vi.provider.services.status.active
        : vi.provider.services.status.inactive}
    </span>
  );
}
