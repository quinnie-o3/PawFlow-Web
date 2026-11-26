import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import type { ProviderApiErrorInfo } from "../../provider-workspace/liveApi";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import { formatCustomerSlot } from "../customerLogic";
import type { CustomerRecord } from "../types";
import CustomerGroupBadge from "./CustomerGroupBadge";
import styles from "../customers.module.css";

export default function CustomersList({
  status,
  error,
  refreshError,
  reloading,
  cooldownSeconds,
  records,
  total,
  onSelect,
  onClearFilters,
  onRetry,
}: {
  status: "idle" | "loading" | "ready" | "error";
  error: ProviderApiErrorInfo | null;
  refreshError: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  records: readonly CustomerRecord[];
  total: number;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
  onRetry: () => void;
}) {
  return (
    <section className={styles.listCard} aria-labelledby="customers-list-title">
      <div>
        <h2 id="customers-list-title">{vi.provider.customers.list.title}</h2>
        <p>{vi.provider.customers.list.description}</p>
      </div>

      {refreshError && (
        <div className={styles.error} role="alert">
          {getProviderErrorMessage(refreshError, cooldownSeconds)}
        </div>
      )}

      {status === "loading" ? (
        <div className={styles.stateBox} role="status" aria-busy="true">
          <p>{vi.provider.customers.list.loading}</p>
        </div>
      ) : status === "error" ? (
        <div className={styles.errorBox} role="alert">
          <h3>{vi.provider.customers.list.errorTitle}</h3>
          <p>
            {error
              ? getProviderErrorMessage(error, cooldownSeconds)
              : vi.provider.workspace.errors.UNKNOWN_ERROR}
          </p>
          <button
            type="button"
            className={styles.softButton}
            disabled={reloading || cooldownSeconds > 0}
            onClick={onRetry}
          >
            <RefreshCw aria-hidden="true" size={14} />
            {vi.provider.customers.list.retry}
          </button>
        </div>
      ) : (
        <>
          <p className={styles.resultCount} role="status">
            {formatMessage(vi.provider.customers.list.resultCount, {
              visible: records.length,
              total,
            })}
          </p>
          {records.length > 0 ? (
            <div
              className={styles.tableRegion}
              role="region"
              aria-label={vi.provider.customers.list.region}
              tabIndex={0}
            >
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  {vi.provider.customers.list.caption}
                </caption>
                <thead>
                  <tr>
                    {[
                      vi.provider.customers.list.customer,
                      vi.provider.customers.list.pet,
                      vi.provider.customers.list.bookingsAndSpend,
                      vi.provider.customers.list.appointments,
                      vi.provider.customers.list.group,
                      vi.provider.customers.list.details,
                    ].map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.customer.id}>
                      <th scope="row">
                        <span className={styles.customerName}>
                          {record.customer.fullName}
                        </span>
                        <span className={styles.customerId}>
                          #{record.customer.id}
                        </span>
                      </th>
                      <td>
                        {record.pets.slice(0, 2).map((pet) => (
                          <span className={styles.petPreview} key={pet.id}>
                            {pet.name} · {pet.petTypeName}
                          </span>
                        ))}
                        {record.pets.length > 2 && (
                          <span className={styles.customerId}>
                            {formatMessage(
                              vi.provider.customers.list.additionalPets,
                              { count: record.pets.length - 2 },
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={styles.metricLine}>
                          {formatMessage(
                            vi.provider.customers.list.completedRatio,
                            {
                              completed: record.completedCount,
                              total: record.statusCounts.total,
                            },
                          )}
                        </span>
                        <span className={styles.spendValue}>
                          {record.totalCompletedSpendFormatted}
                        </span>
                      </td>
                      <td>
                        <span className={styles.metricLine}>
                          {record.latestCompletedSlot
                            ? formatMessage(
                                vi.provider.customers.list.latestPrefix,
                                {
                                  time: formatCustomerSlot(
                                    record.latestCompletedSlot,
                                  ),
                                },
                              )
                            : formatMessage(
                                vi.provider.customers.list.latestPrefix,
                                { time: vi.provider.customers.labels.unavailable },
                              )}
                        </span>
                        {record.nextUpcomingSlot && (
                          <span className={styles.customerId}>
                            {formatMessage(
                              vi.provider.customers.list.upcomingPrefix,
                              {
                                time: formatCustomerSlot(
                                  record.nextUpcomingSlot,
                                ),
                              },
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        <CustomerGroupBadge group={record.group} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.textButton}
                          aria-label={formatMessage(
                            vi.provider.customers.list.viewLabel,
                            {
                              customerName: record.customer.fullName,
                              customerId: record.customer.id,
                            },
                          )}
                          onClick={() => onSelect(record.customer.id)}
                        >
                          {vi.provider.customers.list.viewProfile}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>
              <h3>
                {total === 0
                  ? vi.provider.customers.empty.noCustomers
                  : vi.provider.customers.empty.noResults}
              </h3>
              <p>
                {total === 0
                  ? vi.provider.customers.empty.noCustomersDescription
                  : vi.provider.customers.empty.noResultsDescription}
              </p>
              {total > 0 && (
                <button
                  type="button"
                  className={styles.softButton}
                  onClick={onClearFilters}
                >
                  {vi.provider.customers.empty.clearFilters}
                </button>
              )}
            </div>
          )}
          <p className={styles.lifetimeNote}>
            {vi.provider.customers.list.lifetimeNote}
          </p>
          <p>{vi.provider.customers.list.profileNote}</p>
        </>
      )}
    </section>
  );
}
