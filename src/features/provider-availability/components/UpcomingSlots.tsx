import { vi, formatMessage } from "@/lib/locale";
import Link from "next/link";
import { formatAvailabilityDate, heldSeats } from "../availabilityLogic";
import type { AvailabilitySlot, SlotReservation } from "../types";
import styles from "../availability.module.css";

export default function UpcomingSlots({ slots, reservations, onSelect, onShowAll }: {
  slots: AvailabilitySlot[]; reservations: SlotReservation[]; onSelect: (id: string) => void; onShowAll: () => void;
}) {
  return <section className={styles.card} aria-labelledby="upcoming-slots-title">
    <h2><button type="button" id="upcoming-slots-title" className={styles.headingButton} onClick={onShowAll}>{vi.provider.availability.upcoming.title}</button></h2>
    <ul className={styles.upcomingList}>{slots.filter((slot) => slot.open).slice(0, 3).map((slot) => <li key={slot.id}>
      <button type="button" className={styles.slotPreview} onClick={() => onSelect(slot.id)} aria-label={formatMessage(vi.provider.availability.upcoming.manageLabel, { date: formatAvailabilityDate(slot.date), start: slot.start })}>
        {formatAvailabilityDate(slot.date, false)} · {slot.start} <span>{formatMessage(vi.provider.availability.upcoming.heldCapacity, { held: heldSeats(slot.id, reservations), capacity: slot.capacity })}</span>
      </button>
    </li>)}</ul>
    {!slots.some((slot) => slot.open) && <p className={styles.empty}>{vi.provider.availability.upcoming.empty}</p>}
    <Link href="/dashboard/bookings" className={styles.textButton}>{vi.provider.availability.upcoming.viewBookings}</Link>
  </section>;
}
