"use client";

import { formatMessage, vi } from "@/lib/locale";
import ProviderWorkspaceDialog from "../../provider-workspace/components/ProviderWorkspaceDialog";
import {
  BOOKING_STATUS_LABELS,
  PROVIDER_BOOKING_STATUS_ORDER,
} from "../../provider-bookings/bookingLogic";
import { formatCustomerDate } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerBookingHistory from "./CustomerBookingHistory";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomerDetailsDialog({
  record,
  facilityName,
  onClose,
}: {
  record: CustomerRecord;
  facilityName: string;
  onClose: () => void;
}) {
  return (
    <ProviderWorkspaceDialog
      title={formatMessage(vi.provider.customers.details.title, {
        customerName: record.customer.fullName,
      })}
      subtitle={formatMessage(vi.provider.customers.details.subtitle, {
        customerId: record.customer.id,
        facilityName: facilityName || vi.provider.customers.page.title,
      })}
      restoreFocusFallbackId="customers-title"
      onClose={onClose}
    >
      <div className={styles.details}>
        <CustomerGroupBadge group={record.group} />

        <section
          className={styles.detailSection}
          aria-labelledby="customer-contact-title"
        >
          <h3 id="customer-contact-title">
            {vi.provider.customers.details.contact}
          </h3>
          <p className={styles.help}>
            {vi.provider.customers.privacy.description}
          </p>
          <dl className={styles.contactFields}>
            <div>
              <dt>{vi.provider.customers.labels.customerId}</dt>
              <dd>#{record.customer.id}</dd>
            </div>
            <div>
              <dt>{vi.provider.customers.labels.name}</dt>
              <dd>{record.customer.fullName}</dd>
            </div>
            <div>
              <dt>{vi.provider.customers.labels.phone}</dt>
              <dd className={styles.piiMuted}>
                {vi.provider.customers.privacy.hiddenValue}
              </dd>
            </div>
            <div>
              <dt>{vi.provider.customers.labels.email}</dt>
              <dd className={styles.piiMuted}>
                {vi.provider.customers.privacy.hiddenValue}
              </dd>
            </div>
            <div>
              <dt>{vi.provider.customers.labels.totalBookings}</dt>
              <dd>{record.statusCounts.total}</dd>
            </div>
            <div>
              <dt>{vi.provider.customers.labels.totalSpend}</dt>
              <dd>
                <strong>{record.totalCompletedSpendFormatted}</strong>
              </dd>
            </div>
          </dl>
        </section>

        <section
          className={styles.detailSection}
          aria-labelledby="customer-status-breakdown-title"
        >
          <h3 id="customer-status-breakdown-title">
            {vi.provider.customers.details.statusBreakdown}
          </h3>
          <ul className={styles.statusPills}>
            {PROVIDER_BOOKING_STATUS_ORDER.map((status) => (
              <li key={status}>
                {BOOKING_STATUS_LABELS[status]}: {record.statusCounts[status]}
              </li>
            ))}
          </ul>
        </section>

        <section
          className={styles.detailSection}
          aria-labelledby="customer-pets-title"
        >
          <h3 id="customer-pets-title">
            {formatMessage(vi.provider.customers.details.petsTitle, {
              count: record.pets.length,
            })}
          </h3>
          <ul className={styles.pets}>
            {record.pets.map((pet) => (
              <li key={pet.id}>
                <strong>{pet.name}</strong>
                <span className={styles.customerId}>#{pet.id}</span>
                <p>
                  {pet.petTypeName} ·{" "}
                  {pet.breed || vi.provider.customers.details.noBreed}
                </p>
                {(pet.birthDate || pet.weight) && (
                  <p>
                    {[
                      pet.birthDate
                        ? formatMessage(
                            vi.provider.customers.details.birthDateValue,
                            { date: formatCustomerDate(pet.birthDate) },
                          )
                        : null,
                      pet.weight
                        ? formatMessage(
                            vi.provider.customers.details.weightValue,
                            { weight: pet.weight },
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <p>
                  {pet.healthNote || vi.provider.customers.details.noHealthNote}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <CustomerBookingHistory record={record} facilityName={facilityName} />

        <button
          className={styles.softButton}
          type="button"
          onClick={onClose}
        >
          {vi.provider.customers.details.close}
        </button>
      </div>
    </ProviderWorkspaceDialog>
  );
}
