import { vi, formatMessage } from "@/lib/locale";
import { formatCustomerDateTime } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomersList({ records, total, onSelect, onClearFilters }: {
  records: CustomerRecord[];
  total: number;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  return <section className={styles.listCard} aria-labelledby="customers-list-title">
    <div><h2 id="customers-list-title">{vi.provider.customers.list.title}</h2><p>{vi.provider.customers.list.description}</p></div>
    <p className={styles.resultCount} role="status">{formatMessage(vi.provider.customers.list.resultCount, { visible: records.length, total })}</p>
    {records.length > 0 ? <div className={styles.tableRegion} role="region" aria-label={vi.provider.customers.list.region} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{vi.provider.customers.list.caption}</caption>
        <thead><tr>{[vi.provider.customers.page.title, vi.provider.customers.list.pet, vi.provider.customers.list.lastServed, vi.provider.customers.list.completedBookings, vi.provider.customers.list.group, vi.provider.customers.list.details].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{records.map((record) => <tr key={record.customer.id}>
          <th scope="row"><span className={styles.customerName}>{record.customer.name}</span><span className={styles.customerId}>{record.customer.id}</span></th>
          <td>{record.pets.slice(0, 2).map((pet) => <span className={styles.petPreview} key={pet.id}>{pet.name} · {pet.species}</span>)}
            {record.pets.length > 2 && <span className={styles.customerId}>{formatMessage(vi.provider.customers.list.additionalPets, { count: record.pets.length - 2 })}</span>}
          </td>
          <td>{record.lastServedAt ? formatCustomerDateTime(record.lastServedAt) : vi.provider.customers.labels.unavailable}</td>
          <td>{record.completedCount || vi.provider.customers.labels.unavailable}</td>
          <td><CustomerGroupBadge group={record.group} /></td>
          <td><button type="button" className={styles.textButton} aria-label={formatMessage(vi.provider.customers.list.viewLabel, { customerName: record.customer.name, customerId: record.customer.id })} onClick={() => onSelect(record.customer.id)}>{vi.provider.customers.list.viewProfile}</button></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className={styles.empty}>
      <h3>{total === 0 ? vi.provider.customers.empty.noCustomers : vi.provider.customers.empty.noResults}</h3>
      <p>{total === 0 ? vi.provider.customers.empty.noCustomersDescription : vi.provider.customers.empty.noResultsDescription}</p>
      {total > 0 && <button type="button" className={styles.softButton} onClick={onClearFilters}>{vi.provider.customers.empty.clearFilters}</button>}
    </div>}
    <p className={styles.lifetimeNote}>{vi.provider.customers.list.lifetimeNote}</p>
    <p>{vi.provider.customers.list.profileNote}</p>
  </section>;
}
