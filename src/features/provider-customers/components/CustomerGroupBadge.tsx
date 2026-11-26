import { Circle } from "lucide-react";
import { CUSTOMER_GROUP_LABELS } from "../customerLogic";
import type { CustomerGroup } from "../types";
import styles from "../customers.module.css";

export default function CustomerGroupBadge({
  group,
}: {
  group: CustomerGroup;
}) {
  return (
    <span className={`${styles.badge} ${styles[group]}`}>
      <Circle
        aria-hidden="true"
        focusable="false"
        size={7}
        fill="currentColor"
      />
      {CUSTOMER_GROUP_LABELS[group]}
    </span>
  );
}
