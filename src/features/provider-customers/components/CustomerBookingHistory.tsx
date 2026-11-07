import { vi, formatMessageParts } from "@/lib/locale";
import BookingStatusBadge from "@/features/provider-bookings/components/BookingStatusBadge";
import { formatCustomerDateTime } from "../customerLogic";
import type { CustomerRecord } from "../types";
import styles from "../customers.module.css";

export default function CustomerBookingHistory({ record }: { record: CustomerRecord }) {
  return <section className={styles.detailSection} aria-labelledby="customer-history-title">
    <h3 id="customer-history-title">{vi.provider.customers.history.title}</h3>
    <p className={styles.help}>{vi.provider.customers.history.note}</p>
    <ol className={styles.history}>
      {record.bookings.map((booking) => {
        const pet = record.pets.find((item) => item.id === booking.petId);
        return <li key={booking.id}>
          <div className={styles.historyHeading}><strong>{booking.id}</strong><BookingStatusBadge status={booking.status} /></div>
          <p className={styles.historyService}>{booking.serviceName}</p>
          <p>{pet ? `${pet.name} · ${pet.species}` : vi.provider.customers.history.petUnavailable} <span className={styles.customerId}>{booking.petId}</span></p>
          <p>{formatMessageParts(vi.provider.customers.history.startTime, { time: <time key="time" dateTime={booking.scheduledAt}>{formatCustomerDateTime(booking.scheduledAt)}</time> })}</p>
        </li>;
      })}
    </ol>
  </section>;
}
