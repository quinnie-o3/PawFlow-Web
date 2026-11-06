import { vi, formatMessage } from "@/lib/locale";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import type { CustomerRecord } from "../types";
import CustomerBookingHistory from "./CustomerBookingHistory";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomerDetailsDialog({ record, onClose }: { record: CustomerRecord; onClose: () => void }) {
  return <DashboardDialog title={formatMessage(vi.provider.customers.details.title, { customerName: record.customer.name, customerId: record.customer.id })} onClose={onClose}>
    <div className={styles.details}>
      <CustomerGroupBadge group={record.group} />
      <section className={styles.detailSection} aria-labelledby="customer-contact-title">
        <h3 id="customer-contact-title">{vi.provider.customers.details.contact}</h3>
        <p className={styles.help}>{vi.provider.customers.details.note}</p>
        <dl className={styles.contactFields}>
          <div><dt>{vi.provider.customers.labels.customerId}</dt><dd>{record.customer.id}</dd></div>
          <div><dt>{vi.provider.customers.labels.name}</dt><dd>{record.customer.name}</dd></div>
          <div><dt>{vi.provider.customers.labels.phone}</dt><dd>{record.customer.phone || vi.provider.customers.labels.unavailable}</dd></div>
          <div><dt>Email</dt><dd>{record.customer.email || vi.provider.customers.labels.unavailable}</dd></div>
        </dl>
      </section>
      <section className={styles.detailSection} aria-labelledby="customer-pets-title">
        <h3 id="customer-pets-title">{vi.provider.customers.labels.petsAtFacility}</h3>
        <ul className={styles.pets}>{record.pets.map((pet) => <li key={pet.id}>
          <strong>{pet.name}</strong><span className={styles.customerId}>{pet.id}</span><p>{pet.species} · {pet.breed}</p>
        </li>)}</ul>
      </section>
      <CustomerBookingHistory record={record} />
      <button className={styles.softButton} type="button" onClick={onClose}>{vi.provider.customers.details.close}</button>
    </div>
  </DashboardDialog>;
}
