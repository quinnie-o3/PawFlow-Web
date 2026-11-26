import { Circle } from "lucide-react";
import type { ProviderBookingStatus } from "../../provider-workspace/liveApi";
import { BOOKING_STATUS_LABELS } from "../bookingLogic";
import styles from "../bookings.module.css";

const statusTones: Readonly<Record<ProviderBookingStatus, string>> = {
  PENDING_CONFIRMATION: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  REJECTED: "ended",
  CANCELLED: "ended",
  NO_SHOW: "ended",
};

export default function BookingStatusBadge({
  status,
}: {
  status: ProviderBookingStatus;
}) {
  const tone = statusTones[status];
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      <Circle
        aria-hidden="true"
        focusable="false"
        size={7}
        strokeWidth={2}
        fill="currentColor"
      />
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
