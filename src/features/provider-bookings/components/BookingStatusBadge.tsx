import { Circle } from "lucide-react";
import { statusLabels } from "../bookingLogic";
import type { BookingStatus } from "../types";
import styles from "../bookings.module.css";

const statusTones: Record<BookingStatus, string> = {
  pendingConfirmation: "pending", confirmed: "confirmed", completed: "completed",
  rejected: "ended", cancelled: "ended", noShow: "ended",
};

export default function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const tone = statusTones[status];
  return <span className={`${styles.badge} ${styles[tone]}`}>
    <Circle aria-hidden="true" focusable="false" size={7} strokeWidth={2} fill="currentColor" />
    {statusLabels[status]}
  </span>;
}
