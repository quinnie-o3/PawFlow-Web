import { formatMessage, vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import type { ServicesLoadStatus } from "../useProviderServices";
import type {
  ProviderApiErrorInfo,
  ProviderService,
  ServiceCategoryOption,
} from "../types";
import ServiceCard from "./ServiceCard";
import styles from "../services.module.css";

export default function ServicesList({
  status,
  services,
  total,
  activeCategories,
  categoriesLoaded,
  canManageResources,
  error,
  reloading,
  cooldownSeconds,
  onSelect,
  onCreate,
  onClearFilters,
  onRetry,
}: {
  status: ServicesLoadStatus;
  services: readonly ProviderService[];
  total: number;
  activeCategories: readonly ServiceCategoryOption[];
  categoriesLoaded: boolean;
  canManageResources: boolean;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  cooldownSeconds: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClearFilters: () => void;
  onRetry: () => void;
}) {
  const listLocale = vi.provider.services.list;

  if (status === "idle" || status === "loading") {
    return (
      <section
        aria-label={listLocale.label}
        aria-busy="true"
        role="status"
      >
        <p className={styles.srOnly}>{listLocale.loading}</p>
        <div className={styles.grid} aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className={styles.skeletonCard}>
              <div className={`${styles.skeletonBar} ${styles.skeletonBarTitle}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarMedium}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarFull}`} />
              <div className={`${styles.skeletonBar} ${styles.skeletonBarMedium}`} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (status === "error") {
    const message = error
      ? getProviderErrorMessage(error, cooldownSeconds)
      : vi.provider.workspace.errors.UNKNOWN_ERROR;
    return (
      <section className={styles.errorPanel} aria-label={listLocale.label}>
        <h2>{listLocale.errorTitle}</h2>
        <p role="alert">{message}</p>
        <button
          type="button"
          className={styles.softButton}
          disabled={reloading || cooldownSeconds > 0}
          onClick={onRetry}
        >
          {reloading ? vi.provider.services.page.reloading : listLocale.retry}
        </button>
      </section>
    );
  }

  return (
    <section aria-label={listLocale.label}>
      <p className={styles.srOnly} role="status">
        {formatMessage(listLocale.resultCount, {
          visible: services.length,
          total,
        })}
      </p>

      {services.length > 0 ? (
        <div className={styles.grid}>
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              activeCategories={activeCategories}
              categoriesLoaded={categoriesLoaded}
              canManageResources={canManageResources}
              onSelect={() => onSelect(service.id)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>
            {total === 0 ? listLocale.emptyTitle : listLocale.noResultsTitle}
          </h2>
          <p>
            {total === 0
              ? canManageResources
                ? listLocale.emptyDescription
                : listLocale.emptyReadonlyDescription
              : listLocale.noResultsDescription}
          </p>
          {total === 0 ? (
            canManageResources && (
              <button
                type="button"
                className={styles.softButton}
                onClick={onCreate}
              >
                {listLocale.createFirst}
              </button>
            )
          ) : (
            <button
              type="button"
              className={styles.softButton}
              onClick={onClearFilters}
            >
              {listLocale.clearFilters}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
