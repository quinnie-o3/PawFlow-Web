import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import {
  getServiceCategoryName,
  isServiceCategoryInactive,
} from "../serviceLogic";
import type { CategoriesLoadStatus } from "../useProviderServices";
import type {
  ProviderApiErrorInfo,
  ProviderService,
  ServiceCategoryOption,
} from "../types";
import styles from "../services.module.css";

export default function ServiceCategoryField({
  inputId,
  categories,
  categoriesStatus,
  categoriesError,
  value,
  currentService,
  disabled,
  error,
  onChange,
  onReloadCategories,
}: {
  inputId: string;
  categories: readonly ServiceCategoryOption[];
  categoriesStatus: CategoriesLoadStatus;
  categoriesError: ProviderApiErrorInfo | null;
  value: string;
  currentService?: ProviderService | null;
  disabled: boolean;
  error?: string;
  onChange: (categoryId: string) => void;
  onReloadCategories: () => void;
}) {
  const categoryLocale = vi.provider.services.category;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const categoriesLoaded = categoriesStatus === "ready";
  const currentCategoryName = currentService
    ? getServiceCategoryName(currentService, categories)
    : "";
  const currentCategoryInactive = currentService
    ? isServiceCategoryInactive(currentService, categories, categoriesLoaded)
    : false;
  const showFallbackCurrentOption =
    currentService !== null &&
    currentService !== undefined &&
    !categories.some((item) => item.id === currentService.categoryId);

  const describedBy = error ? `${errorId} ${hintId}` : hintId;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{categoryLocale.requiredLabel}</label>

      <select
        id={inputId}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">{categoryLocale.choose}</option>
        {showFallbackCurrentOption && currentService && (
          <option value={currentService.categoryId}>
            {currentCategoryInactive
              ? formatMessage(categoryLocale.inactiveOption, {
                  name: currentCategoryName,
                })
              : currentCategoryName}
          </option>
        )}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {error && (
        <span id={errorId} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}

      {currentService &&
        currentCategoryInactive &&
        value === currentService.categoryId && (
          <div className={styles.warningBox} role="note">
            <p>
              {formatMessage(categoryLocale.inactiveWarning, {
                name: currentCategoryName,
              })}
            </p>
          </div>
        )}

      {categoriesStatus === "loading" && (
        <span className={styles.fieldHint} role="status">
          {categoryLocale.loading}
        </span>
      )}

      {categoriesStatus === "error" && (
        <div className={styles.inlineRetryRow}>
          <span className={styles.fieldError} role="alert">
            {categoriesError
              ? getProviderErrorMessage(categoriesError)
              : categoryLocale.loadError}
          </span>
          <button
            type="button"
            className={styles.inlineRetryButton}
            disabled={disabled}
            onClick={onReloadCategories}
          >
            <RefreshCw aria-hidden="true" focusable="false" size={12} />
            {categoryLocale.retry}
          </button>
        </div>
      )}

      {categoriesStatus === "ready" && categories.length === 0 && (
        <div className={styles.inlineRetryRow}>
          <span className={styles.fieldHint}>{categoryLocale.empty}</span>
          <button
            type="button"
            className={styles.inlineRetryButton}
            disabled={disabled}
            onClick={onReloadCategories}
          >
            <RefreshCw aria-hidden="true" focusable="false" size={12} />
            {categoryLocale.retry}
          </button>
        </div>
      )}

      <span id={hintId} className={styles.fieldHint}>
        {categoryLocale.adminManagedHint}
      </span>
    </div>
  );
}
