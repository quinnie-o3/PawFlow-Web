import { formatMessage, formatMessageParts, vi } from "@/lib/locale";
import { formatCustomerSlot } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomerProfile({
  record,
  facilityName,
  onOpen,
}: {
  record: CustomerRecord;
  facilityName: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section
      className={styles.profile}
      aria-labelledby="customer-profile-title"
    >
      <div className={styles.profileHeading}>
        <h2 id="customer-profile-title">
          {formatMessageParts(vi.provider.customers.profile.title, {
            customerName: record.customer.fullName,
            customerId: (
              <span key="customerId" className={styles.customerId}>
                #{record.customer.id}
              </span>
            ),
          })}
        </h2>
        <button
          type="button"
          className={styles.outlineButton}
          onClick={() => onOpen(record.customer.id)}
        >
          {vi.provider.customers.profile.viewHistory}
        </button>
      </div>
      <p>
        {facilityName
          ? formatMessage(vi.provider.customers.profile.note, { facilityName })
          : vi.provider.customers.profile.noteFallback}
      </p>
      <dl className={styles.profileFields}>
        <div>
          <dt>{vi.provider.customers.labels.petsAtFacility}</dt>
          <dd>
            {record.pets.map((pet) => (
              <span className={styles.petPreview} key={pet.id}>
                {pet.name} · {pet.petTypeName}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>{vi.provider.customers.profile.completedBookings}</dt>
          <dd>
            {formatMessage(vi.provider.customers.profile.bookingRatio, {
              completed: record.completedCount,
              total: record.statusCounts.total,
            })}
          </dd>
        </div>
        <div>
          <dt>{vi.provider.customers.profile.totalSpend}</dt>
          <dd>{record.totalCompletedSpendFormatted}</dd>
        </div>
        <div>
          <dt>{vi.provider.customers.profile.latestAppointment}</dt>
          <dd>
            {record.latestCompletedSlot
              ? formatCustomerSlot(record.latestCompletedSlot)
              : vi.provider.customers.labels.unavailable}
          </dd>
        </div>
        <div>
          <dt>{vi.provider.customers.profile.nextUpcoming}</dt>
          <dd>
            {record.nextUpcomingSlot
              ? formatCustomerSlot(record.nextUpcomingSlot)
              : vi.provider.customers.labels.unavailable}
          </dd>
        </div>
        <div>
          <dt>{vi.provider.customers.profile.periodGroup}</dt>
          <dd>
            <CustomerGroupBadge group={record.group} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
