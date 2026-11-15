import { vi, formatMessage, formatMessageParts } from "@/lib/locale";
import { formatCustomerDateTime } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomerProfile({ record, onOpen }: { record: CustomerRecord; onOpen: (id: string) => void }) {
  return <section className={styles.profile} aria-labelledby="customer-profile-title">
    <div className={styles.profileHeading}><h2 id="customer-profile-title">{formatMessageParts(vi.provider.customers.profile.title, { customerName: record.customer.name, customerId: <span key="customerId" className={styles.customerId}>{record.customer.id}</span> })}</h2>
      <button type="button" className={styles.outlineButton} onClick={() => onOpen(record.customer.id)}>{vi.provider.customers.profile.viewHistory}</button></div>
    <p>{vi.provider.customers.profile.note}</p>
    <dl className={styles.profileFields}>
      <div><dt>{vi.provider.customers.labels.petsAtFacility}</dt><dd>{record.pets.map((pet) => <span className={styles.petPreview} key={pet.id}>{pet.name} · {pet.species}</span>)}</dd></div>
      <div><dt>{vi.provider.customers.profile.completedBookings}</dt><dd>{record.completedCount ? formatMessage(vi.provider.customers.profile.bookingCount, { count: record.completedCount }) : vi.provider.customers.labels.unavailable}</dd></div>
      <div><dt>{vi.provider.customers.profile.lastServed}</dt><dd>{record.lastServedAt ? formatCustomerDateTime(record.lastServedAt) : vi.provider.customers.labels.unavailable}</dd></div>
      <div><dt>{vi.provider.customers.profile.periodGroup}</dt><dd><CustomerGroupBadge group={record.group} /></dd></div>
    </dl>
  </section>;
}
