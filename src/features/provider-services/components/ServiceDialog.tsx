"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import ProviderWorkspaceDialog from "@/features/provider-workspace/components/ProviderWorkspaceDialog";
import {
  formatDuration,
  getServiceCategoryName,
  isServiceCategoryInactive,
} from "../serviceLogic";
import type { CategoriesLoadStatus } from "../useProviderServices";
import type {
  ProviderApiErrorInfo,
  ProviderService,
  ProviderServiceStatus,
  ServiceCategoryOption,
  ServiceEditorState,
  ServiceFieldKey,
} from "../types";
import ServiceCategoryField from "./ServiceCategoryField";
import ServiceStatusBadge from "./ServiceStatusBadge";
import styles from "../services.module.css";

export default function ServiceDialog({
  editor,
  service,
  categories,
  categoriesStatus,
  categoriesError,
  canManageResources,
  hasChanges,
  locked,
  cooldownSeconds,
  onChangeField,
  onReloadCategories,
  onSave,
  onRequestStatusChange,
  onCancelStatusChange,
  onConfirmStatusChange,
  onReconcile,
  onClose,
}: {
  editor: ServiceEditorState;
  service: ProviderService | null;
  categories: readonly ServiceCategoryOption[];
  categoriesStatus: CategoriesLoadStatus;
  categoriesError: ProviderApiErrorInfo | null;
  canManageResources: boolean;
  hasChanges: boolean;
  locked: boolean;
  cooldownSeconds: number;
  onChangeField: (field: ServiceFieldKey, value: string) => void;
  onReloadCategories: () => void;
  onSave: () => void;
  onRequestStatusChange: (targetStatus: ProviderServiceStatus) => void;
  onCancelStatusChange: () => void;
  onConfirmStatusChange: () => void;
  onReconcile: () => void;
  onClose: () => void;
}) {
  const dialogLocale = vi.provider.services.dialog;
  const isEdit = editor.mode === "edit" && service !== null;
  const busy = editor.saving || editor.updatingStatus || editor.reconciling;
  const hasUncertain = editor.uncertain !== null;
  const readOnly = !canManageResources || locked;
  const inputsDisabled = readOnly || busy || hasUncertain;
  const hasValidationErrors = Object.values(editor.errors).some(Boolean);
  const categoriesLoaded = categoriesStatus === "ready";
  const categoryInactive = service
    ? isServiceCategoryInactive(service, categories, categoriesLoaded)
    : false;

  const title = isEdit
    ? formatMessage(
        canManageResources ? dialogLocale.editTitle : dialogLocale.viewTitle,
        { serviceName: service.name },
      )
    : dialogLocale.createTitle;

  const subtitle = !canManageResources
    ? dialogLocale.readonlySubtitle
    : isEdit
      ? dialogLocale.editSubtitle
      : dialogLocale.createSubtitle;

  const uncertainDescription =
    editor.uncertain?.kind === "create"
      ? dialogLocale.uncertainCreateDescription
      : editor.uncertain?.kind === "update"
        ? dialogLocale.uncertainUpdateDescription
        : dialogLocale.uncertainStatusDescription;

  const saveDisabled =
    inputsDisabled || cooldownSeconds > 0 || (isEdit && !hasChanges);

  const nextToggleStatus: ProviderServiceStatus =
    service?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <ProviderWorkspaceDialog
      title={title}
      subtitle={subtitle}
      disableClose={busy}
      restoreFocusFallbackId="services-title"
      onClose={onClose}
    >
      {isEdit && service && (
        <div className={styles.detailIntro}>
          <p>
            {getServiceCategoryName(service, categories)} ·{" "}
            {formatDuration(service.durationMinutes)}
          </p>
          <ServiceStatusBadge status={service.status} />
        </div>
      )}

      {!canManageResources && (
        <div className={styles.readonlyNotice} role="note">
          {dialogLocale.readonlyNotice}
        </div>
      )}

      {editor.reconcileNote && !hasUncertain && (
        <p className={styles.success} role="status">
          {editor.reconcileNote}
        </p>
      )}

      {editor.statusFeedback && (
        <p className={styles.success} role="status">
          {editor.statusFeedback}
        </p>
      )}

      {hasUncertain && (
        <section className={styles.warningBox} role="alert" aria-live="polite">
          <h3>{dialogLocale.uncertainTitle}</h3>
          <p>{uncertainDescription}</p>
          {editor.reconcileNote && (
            <p role="status">{editor.reconcileNote}</p>
          )}
          <div className={styles.warningBoxActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={busy || locked || cooldownSeconds > 0}
              onClick={onReconcile}
            >
              <RefreshCw
                aria-hidden="true"
                focusable="false"
                size={14}
                className={styles.inlineIcon}
              />{" "}
              {editor.reconciling
                ? dialogLocale.reconciling
                : dialogLocale.reconcileAction}
            </button>
          </div>
        </section>
      )}

      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        {hasValidationErrors && (
          <p className={styles.error} role="alert">
            {dialogLocale.validationSummary}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="service-field-name">{dialogLocale.nameLabel}</label>
          <input
            id="service-field-name"
            type="text"
            maxLength={200}
            value={editor.draft.name}
            disabled={inputsDisabled}
            aria-invalid={editor.errors.name ? true : undefined}
            aria-describedby={
              editor.errors.name
                ? "service-field-name-error service-field-name-hint"
                : "service-field-name-hint"
            }
            onChange={(event) => onChangeField("name", event.target.value)}
            required
          />
          {editor.errors.name && (
            <span
              id="service-field-name-error"
              className={styles.fieldError}
              role="alert"
            >
              {editor.errors.name}
            </span>
          )}
          <span id="service-field-name-hint" className={styles.fieldHint}>
            {dialogLocale.nameHint}
          </span>
        </div>

        <ServiceCategoryField
          inputId="service-field-categoryId"
          categories={categories}
          categoriesStatus={categoriesStatus}
          categoriesError={categoriesError}
          value={editor.draft.categoryId}
          currentService={service}
          disabled={inputsDisabled}
          error={editor.errors.categoryId}
          onChange={(value) => onChangeField("categoryId", value)}
          onReloadCategories={onReloadCategories}
        />

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="service-field-price">
              {dialogLocale.priceLabel}
            </label>
            <input
              id="service-field-price"
              type="text"
              inputMode="decimal"
              value={editor.draft.price}
              disabled={inputsDisabled}
              aria-invalid={editor.errors.price ? true : undefined}
              aria-describedby={
                editor.errors.price
                  ? "service-field-price-error service-field-price-hint"
                  : "service-field-price-hint"
              }
              onChange={(event) => onChangeField("price", event.target.value)}
              required
            />
            {editor.errors.price && (
              <span
                id="service-field-price-error"
                className={styles.fieldError}
                role="alert"
              >
                {editor.errors.price}
              </span>
            )}
            <span id="service-field-price-hint" className={styles.fieldHint}>
              {dialogLocale.priceHint}
            </span>
          </div>

          <div className={styles.field}>
            <label htmlFor="service-field-durationMinutes">
              {dialogLocale.durationLabel}
            </label>
            <input
              id="service-field-durationMinutes"
              type="text"
              inputMode="numeric"
              value={editor.draft.durationMinutes}
              disabled={inputsDisabled}
              aria-invalid={editor.errors.durationMinutes ? true : undefined}
              aria-describedby={
                editor.errors.durationMinutes
                  ? "service-field-durationMinutes-error service-field-durationMinutes-hint"
                  : "service-field-durationMinutes-hint"
              }
              onChange={(event) =>
                onChangeField("durationMinutes", event.target.value)
              }
              required
            />
            {editor.errors.durationMinutes && (
              <span
                id="service-field-durationMinutes-error"
                className={styles.fieldError}
                role="alert"
              >
                {editor.errors.durationMinutes}
              </span>
            )}
            <span
              id="service-field-durationMinutes-hint"
              className={styles.fieldHint}
            >
              {dialogLocale.durationHint}
            </span>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="service-field-description">
            {dialogLocale.descriptionLabel}
          </label>
          <textarea
            id="service-field-description"
            rows={3}
            value={editor.draft.description}
            disabled={inputsDisabled}
            aria-describedby="service-field-description-hint"
            onChange={(event) =>
              onChangeField("description", event.target.value)
            }
          />
          <span
            id="service-field-description-hint"
            className={styles.fieldHint}
          >
            {dialogLocale.descriptionHint}
          </span>
        </div>

        <p className={styles.invariantNote}>
          {dialogLocale.bookingSnapshotHint}
        </p>

        {editor.saveError && (
          <div className={styles.error} role="alert">
            <p>{getProviderErrorMessage(editor.saveError, cooldownSeconds)}</p>
            {editor.saveError.code ===
              "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS" && (
              <div className={styles.conflictGuidance}>
                <p>{dialogLocale.durationConflictAction}</p>
                <Link href="/dashboard/availability" prefetch={false}>
                  {vi.provider.services.links.availability}{" "}
                  <ArrowRight
                    aria-hidden="true"
                    focusable="false"
                    size={13}
                    strokeWidth={2}
                    className={styles.inlineIcon}
                  />
                </Link>
              </div>
            )}
          </div>
        )}

        {canManageResources && (
          <>
            {isEdit && !hasChanges && !editor.saveError && !hasUncertain && (
              <p className={styles.fieldHint}>{dialogLocale.noChangesHint}</p>
            )}
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saveDisabled}
            >
              {editor.saving
                ? isEdit
                  ? dialogLocale.saving
                  : dialogLocale.creating
                : isEdit
                  ? dialogLocale.saveChanges
                  : dialogLocale.createService}
            </button>
          </>
        )}
      </form>

      {isEdit && service && (
        <div className={styles.actions}>
          {editor.statusError && !canManageResources && (
            <p className={styles.error} role="alert">
              {getProviderErrorMessage(editor.statusError, cooldownSeconds)}
            </p>
          )}
          {canManageResources && (
            <>
              <button
                id="service-dialog-status-trigger"
                type="button"
                className={styles.softButton}
                disabled={busy || hasUncertain || locked || cooldownSeconds > 0}
                onClick={() => onRequestStatusChange(nextToggleStatus)}
              >
                {service.status === "ACTIVE"
                  ? dialogLocale.hideService
                  : dialogLocale.showAgain}
              </button>

              {editor.statusError && (
                <p className={styles.error} role="alert">
                  {getProviderErrorMessage(editor.statusError, cooldownSeconds)}
                </p>
              )}

              {editor.confirmStatus !== null && (
                <section
                  className={styles.confirmation}
                  aria-labelledby="service-dialog-confirm-title"
                >
                  <h3 id="service-dialog-confirm-title">
                    {editor.confirmStatus === "ACTIVE"
                      ? dialogLocale.showAgainTitle
                      : dialogLocale.hideTitle}
                  </h3>
                  <p>
                    {editor.confirmStatus === "ACTIVE"
                      ? dialogLocale.reactivateExplanation
                      : dialogLocale.hideExplanation}
                  </p>
                  {editor.confirmStatus === "ACTIVE" && categoryInactive && (
                    <div className={styles.warningBox} role="note">
                      <p>{dialogLocale.reactivateInactiveCategoryWarning}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={
                      busy || hasUncertain || locked || cooldownSeconds > 0
                    }
                    onClick={onConfirmStatusChange}
                  >
                    {editor.updatingStatus
                      ? editor.confirmStatus === "ACTIVE"
                        ? dialogLocale.showing
                        : dialogLocale.hiding
                      : editor.confirmStatus === "ACTIVE"
                        ? dialogLocale.confirmShow
                        : dialogLocale.confirmHide}
                  </button>
                  <button
                    type="button"
                    className={styles.softButton}
                    disabled={busy}
                    onClick={() => {
                      onCancelStatusChange();
                      window.requestAnimationFrame(() => {
                        document
                          .getElementById("service-dialog-status-trigger")
                          ?.focus();
                      });
                    }}
                  >
                    {dialogLocale.back}
                  </button>
                </section>
              )}
            </>
          )}

          <Link
            href="/dashboard/availability"
            prefetch={false}
            className={styles.editLink}
          >
            {vi.provider.services.links.availability}{" "}
            <ArrowRight
              aria-hidden="true"
              focusable="false"
              size={14}
              strokeWidth={2}
              className={styles.inlineIcon}
            />
          </Link>
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.softButton}
          disabled={busy}
          onClick={onClose}
        >
          {vi.common.actions.close}
        </button>
      </div>
    </ProviderWorkspaceDialog>
  );
}
