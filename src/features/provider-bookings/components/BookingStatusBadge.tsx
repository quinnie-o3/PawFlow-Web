import Image from "next/image";
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
    <Image src={`/bookings/status-${tone}.svg`} alt="" width={7} height={7} />
    {statusLabels[status]}
  </span>;
}
