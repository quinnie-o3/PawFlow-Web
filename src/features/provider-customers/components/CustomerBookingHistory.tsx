import Link from "next/link";
import { formatMessage, vi } from "@/lib/locale";
import BookingStatusBadge from "@/features/provider-bookings/components/BookingStatusBadge";
import { formatVndAmount } from "@/features/provider-bookings/bookingLogic";
import { formatCustomerSlot } from "../customerLogic";
import type { CustomerRecord } from "../types";
import styles from "../customers.module.css";

export default function CustomerBookingHistory({
  record,
  facilityName,
}: {
  record: CustomerRecord;
  facilityName: string;
}) {
  return (
    <section
      className={styles.detailSection}
      aria-labelledby="customer-history-title"
    >
      <h3 id="customer-history-title">
        {formatMessage(vi.provider.customers.history.title, {
          count: record.bookings.length,
        })}
      </h3>
      <p className={styles.help}>
        {facilityName
          ? formatMessage(vi.provider.customers.history.note, { facilityName })
          : vi.provider.customers.history.noteFallback}
      </p>
      <ol className={styles.history}>
        {record.bookings.map((booking) => (
          <li key={booking.id}>
            <div className={styles.historyHeading}>
              <strong>#{booking.id}</strong>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className={styles.historyService}>{booking.service.name}</p>
            <p>
              {formatMessage(vi.provider.customers.history.petSummary, {
                petName: booking.pet.name,
                petType: booking.pet.petType.name,
              })}{" "}
              <span className={styles.customerId}>#{booking.pet.id}</span>
            </p>
            <p>
              {formatMessage(vi.provider.customers.history.slotTime, {
                time: formatCustomerSlot(booking.slot),
              })}
            </p>
            <p>
              {formatMessage(vi.provider.customers.history.bookedPrice, {
                price: formatVndAmount(booking.bookedPrice),
              })}
            </p>
            {booking.customerNote && (
              <p>
                {formatMessage(vi.provider.customers.history.customerNote, {
                  note: booking.customerNote,
                })}
              </p>
            )}
            <Link
              href={`/dashboard/bookings?q=${encodeURIComponent(booking.id)}`}
              prefetch={false}
              className={styles.historyLink}
            >
              {vi.provider.customers.history.openBooking}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
