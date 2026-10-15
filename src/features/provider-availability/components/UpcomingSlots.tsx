import Link from "next/link";
import { formatAvailabilityDate, heldSeats } from "../availabilityLogic";
import type { AvailabilitySlot, SlotReservation } from "../types";
import styles from "../availability.module.css";

export default function UpcomingSlots({ slots, reservations, onSelect, onShowAll }: {
  slots: AvailabilitySlot[]; reservations: SlotReservation[]; onSelect: (id: string) => void; onShowAll: () => void;
}) {
  return <section className={styles.card} aria-labelledby="upcoming-slots-title">
    <h2><button type="button" id="upcoming-slots-title" className={styles.headingButton} onClick={onShowAll}>Khung gần nhất</button></h2>
    <ul className={styles.upcomingList}>{slots.filter((slot) => slot.open).slice(0, 3).map((slot) => <li key={slot.id}>
      <button type="button" className={styles.slotPreview} onClick={() => onSelect(slot.id)} aria-label={`Quản lý khung ${formatAvailabilityDate(slot.date)} ${slot.start}`}>
        {formatAvailabilityDate(slot.date, false)} · {slot.start} <span>{heldSeats(slot.id, reservations)}/{slot.capacity} chỗ đã đặt</span>
      </button>
    </li>)}</ul>
    {!slots.some((slot) => slot.open) && <p className={styles.empty}>Chưa có khung giờ đang mở.</p>}
    <Link href="/dashboard/bookings" className={styles.textButton}>Xem lịch hẹn</Link>
  </section>;
}
