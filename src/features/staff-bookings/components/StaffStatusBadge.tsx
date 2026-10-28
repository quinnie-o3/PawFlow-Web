import Image from "next/image";
import { staffStatusLabels } from "../staffBookingLogic";
import type { StaffBookingStatus } from "../types";
import styles from "../staffBookings.module.css";

const tones: Record<StaffBookingStatus, string> = {
  pendingConfirmation: "pending", confirmed: "confirmed", completed: "completed", cancelled: "ended", rejected: "ended", noShow: "ended",
};

export default function StaffStatusBadge({ status }: { status: StaffBookingStatus }) {
  const tone = tones[status];
  return <span className={`${styles.badge} ${styles[tone]}`}>
    <Image src={`/bookings/status-${tone}.svg`} width={7} height={7} alt="" />{staffStatusLabels[status]}
  </span>;
}
