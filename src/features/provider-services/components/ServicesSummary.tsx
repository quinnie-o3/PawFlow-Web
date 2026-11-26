import { formatMessage, vi } from "@/lib/locale";
import { isServiceCategoryInactive } from "../serviceLogic";
import type { ProviderService, ServiceCategoryOption } from "../types";
import styles from "../services.module.css";

export default function ServicesSummary({
  services,
  activeCategories,
  categoriesLoaded,
}: {
  services: readonly ProviderService[];
  activeCategories: readonly ServiceCategoryOption[];
  categoriesLoaded: boolean;
}) {
  const activeCount = services.filter(
    (service) => service.status === "ACTIVE",
  ).length;
  const inactiveCount = services.length - activeCount;
  const distinctCategoryIds = new Set(
    services.map((service) => service.categoryId),
  );
  const inactiveCategoryServiceCount = services.filter((service) =>
    isServiceCategoryInactive(service, activeCategories, categoriesLoaded),
  ).length;

  const summaryLocale = vi.provider.services.summary;
  const totalSubtitle =
    services.length === 0
      ? summaryLocale.noServicesHint
      : inactiveCategoryServiceCount > 0
        ? formatMessage(summaryLocale.categoriesUsedWithInactive, {
            count: distinctCategoryIds.size,
            inactiveCount: inactiveCategoryServiceCount,
          })
        : formatMessage(summaryLocale.categoriesUsed, {
            count: distinctCategoryIds.size,
          });

  return (
    <div className={styles.summaries} aria-label={summaryLocale.label}>
      <article>
        <h2>{summaryLocale.activeTitle}</h2>
        <p className={styles.summaryCount}>
          {String(activeCount).padStart(2, "0")}
        </p>
        <p>{summaryLocale.activeHint}</p>
      </article>
      <article>
        <h2>{summaryLocale.inactiveTitle}</h2>
        <p className={styles.summaryCount}>
          {String(inactiveCount).padStart(2, "0")}
        </p>
        <p>{summaryLocale.inactiveHint}</p>
      </article>
      <article>
        <h2>{summaryLocale.totalTitle}</h2>
        <p className={styles.summaryCount}>
          {String(services.length).padStart(2, "0")}
        </p>
        <p>{totalSubtitle}</p>
      </article>
    </div>
  );
}
