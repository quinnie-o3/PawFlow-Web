import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import {
  formatDuration,
  formatPrice,
  getServiceCategoryName,
  isServiceCategoryInactive,
} from "../serviceLogic";
import type { ProviderService, ServiceCategoryOption } from "../types";
import ServiceStatusBadge from "./ServiceStatusBadge";
import styles from "../services.module.css";

export default function ServiceCard({
  service,
  activeCategories,
  categoriesLoaded,
  canManageResources,
  onSelect,
}: {
  service: ProviderService;
  activeCategories: readonly ServiceCategoryOption[];
  categoriesLoaded: boolean;
  canManageResources: boolean;
  onSelect: () => void;
}) {
  const cardLocale = vi.provider.services.card;
  const categoryName = getServiceCategoryName(service, activeCategories);
  const categoryInactive = isServiceCategoryInactive(
    service,
    activeCategories,
    categoriesLoaded,
  );
  const actionAriaLabel = formatMessage(
    canManageResources ? cardLocale.editLabel : cardLocale.viewLabel,
    { serviceName: service.name },
  );

  return (
    <button
      type="button"
      className={styles.serviceCard}
      aria-label={actionAriaLabel}
      onClick={onSelect}
    >
      <span className={styles.cardHeading}>
        <span className={styles.serviceName}>{service.name}</span>
        <ServiceStatusBadge status={service.status} />
      </span>

      <span className={styles.metadataRow}>
        <span className={styles.metadata}>
          {categoryName} · {formatDuration(service.durationMinutes)}
        </span>
        {categoryInactive && (
          <span className={styles.inactiveCategoryTag}>
            <AlertTriangle aria-hidden="true" focusable="false" size={11} />
            {cardLocale.inactiveCategoryBadge}
          </span>
        )}
      </span>

      <span className={styles.description}>
        {service.description ?? cardLocale.noDescription}
      </span>

      <span className={styles.price}>
        {formatMessage(cardLocale.price, { price: formatPrice(service.price) })}
      </span>

      {categoryInactive ? (
        <span className={styles.cardNoteWarning}>
          {cardLocale.inactiveCategoryNote}
        </span>
      ) : (
        <span className={styles.cardNote}>
          {service.status === "INACTIVE"
            ? cardLocale.existingBookingsKept
            : cardLocale.availabilityHint}
        </span>
      )}

      <span className={styles.editLink}>
        {canManageResources ? vi.common.actions.edit : cardLocale.viewDetails}{" "}
        <ArrowRight
          aria-hidden="true"
          focusable="false"
          size={13}
          strokeWidth={2}
          className={styles.inlineIcon}
        />
      </span>
    </button>
  );
}
