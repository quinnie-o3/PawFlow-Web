import { vi, formatMessage } from "@/lib/locale";
import { CalendarDays } from "lucide-react";
import { formatStaffBookingDate } from "../staffBookingLogic";
import type { StaffBooking } from "../types";
import StaffStatusBadge from "./StaffStatusBadge";
import styles from "../staffBookings.module.css";

export default function StaffBookingsList({ bookings, total, filtered, onOpen, onClear }: {
  bookings: readonly StaffBooking[];
  total: number;
  filtered: boolean;
  onOpen: (id: string) => void;
  onClear: () => void;
}) {
  return <>
    <p role="status" className={styles.resultCount}>{formatMessage(vi.staff.bookings.list.resultCount, { visible: bookings.length, total })}</p>
    {bookings.length ? <div className={styles.tableFrame} role="region" aria-label={vi.staff.bookings.list.tableLabel} tabIndex={0}>
      <table><caption className={styles.srOnly}>{formatMessage(vi.staff.bookings.list.caption, { facility: "PawCare Studio" })}</caption>
        <thead><tr>{[vi.staff.bookings.list.idColumn, vi.staff.bookings.list.customerPetColumn, vi.staff.bookings.list.serviceColumn, vi.staff.bookings.list.timeColumn, vi.staff.bookings.list.statusColumn, vi.staff.bookings.list.actionColumn].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{bookings.map((booking) => <tr key={booking.id}>
          <th scope="row">{booking.id}</th><td>{booking.customerName} · {booking.petName}</td>
          <td>{booking.serviceName}</td><td>{formatStaffBookingDate(booking.scheduledAt)}</td>
          <td><StaffStatusBadge status={booking.status} /></td>
          <td><button type="button" className={styles.detailButton} aria-label={formatMessage(vi.staff.bookings.list.viewDetailsLabel, { bookingId: booking.id })} onClick={() => onOpen(booking.id)}>{vi.staff.bookings.list.viewDetails}</button></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className={styles.empty}><CalendarDays size={30} aria-hidden="true" />
      <h3>{filtered ? vi.staff.bookings.list.noResults : vi.staff.bookings.list.emptyTitle}</h3>
      <p>{filtered ? vi.staff.bookings.list.noResultsHint : vi.staff.bookings.list.emptyDescription}</p>
      {filtered && <button type="button" className={styles.secondaryButton} onClick={onClear}>{vi.staff.bookings.list.clearFilters}</button>}
    </div>}
  </>;
}
