"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import ProviderWorkspaceDialog from "@/features/provider-workspace/components/ProviderWorkspaceDialog";
import {
  isValidCalendarDate,
  normalizeTimeToHhMm,
} from "@/features/provider-workspace/liveApi";
import {
  canReopenSlot,
  formatAvailabilityDate,
  formatRanges,
  formatTimeHhMm,
  getDayOfWeek,
  getDayOfWeekLabel,
  hasSlotDraftChanges,
  hasSlotStarted,
  isSlotScheduleLocked,
  localDate,
  resolveSlotService,
  suggestSlotEndTime,
} from "../availabilityLogic";
import type {
  AvailabilityLoadStatus,
  ProviderApiErrorInfo,
  ProviderAvailabilitySlot,
  ProviderService,
  ProviderWorkingHour,
  SlotEditorState,
  SlotFieldKey,
  SlotStatusAction,
} from "../types";
import styles from "../availability.module.css";

export default function SlotDialog({
  editor,
  slot,
  services,
  servicesStatus,
  servicesError,
  workingHours,
  canManageResources,
  busy,
  locked,
  cooldownSeconds,
  now,
  onChangeField,
  onReloadServices,
  onSave,
  onRequestStatusAction,
  onCancelStatusAction,
  onConfirmStatusAction,
  onReconcile,
  onClose,
}: {
  editor: SlotEditorState;
  slot: ProviderAvailabilitySlot | null;
  services: readonly ProviderService[];
  servicesStatus: AvailabilityLoadStatus;
  servicesError: ProviderApiErrorInfo | null;
  workingHours: readonly ProviderWorkingHour[];
  canManageResources: boolean;
  busy: boolean;
  locked: boolean;
  cooldownSeconds: number;
  now: string;
  onChangeField: (field: SlotFieldKey, value: string) => void;
  onReloadServices: () => void;
  onSave: () => void;
  onRequestStatusAction: (action: SlotStatusAction) => void;
  onCancelStatusAction: () => void;
  onConfirmStatusAction: () => void;
  onReconcile: () => void;
  onClose: () => void;
}) {
  const locale = vi.provider.availability.slot;
  const statusesLocale = vi.provider.availability.statuses;

  const isEdit = editor.mode === "edit" && slot !== null;
  const activeServices = services.filter((item) => item.status === "ACTIVE");
  const resolvedExistingService = slot ? resolveSlotService(slot, services) : null;
  const showInactiveCurrentOption =
    isEdit &&
    resolvedExistingService !== null &&
    resolvedExistingService.status !== "ACTIVE";

  const selectedService =
    services.find((item) => item.id === editor.draft.serviceId) ??
    (slot && slot.serviceId === editor.draft.serviceId
      ? resolvedExistingService
      : null);

  const started = isEdit ? hasSlotStarted(slot, now) : false;
  const bookedLocked = isEdit ? slot.bookedCount > 0 : false;
  const scheduleLocked = isEdit ? isSlotScheduleLocked(slot, now) : false;

  const interactionsLocked =
    !canManageResources ||
    busy ||
    locked ||
    editor.uncertain !== null ||
    cooldownSeconds > 0;

  const hasChanges = isEdit
    ? hasSlotDraftChanges(slot, editor.draft, now)
    : true;

  const noActiveServicesForCreate =
    !isEdit && servicesStatus === "ready" && activeServices.length === 0;

  const dateDayOfWeek = isValidCalendarDate(editor.draft.slotDate)
    ? getDayOfWeek(editor.draft.slotDate)
    : null;
  const activeHoursForDate =
    dateDayOfWeek !== null
      ? workingHours.filter(
          (item) => item.isActive && item.dayOfWeek === dateDayOfWeek,
        )
      : [];

  const validDraftStart = normalizeTimeToHhMm(editor.draft.startTime);
  const suggestedEnd =
    selectedService && validDraftStart !== null
      ? suggestSlotEndTime(validDraftStart, selectedService.durationMinutes)
      : undefined;

  const reopenDecision = isEdit
    ? canReopenSlot(slot, services, workingHours, now)
    : null;

  const remainingSeats = isEdit
    ? Math.max(0, slot.capacity - slot.bookedCount)
    : 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (interactionsLocked || noActiveServicesForCreate || !hasChanges) return;
    onSave();
  }

  const title = isEdit
    ? formatMessage(locale.title, {
        date: formatAvailabilityDate(slot.slotDate),
        start: formatTimeHhMm(slot.startTime),
        end: formatTimeHhMm(slot.endTime),
      })
    : locale.create;

  const subtitle = isEdit
    ? formatMessage(locale.subtitleEdit, {
        status: statusesLocale[slot.status],
      })
    : locale.subtitleCreate;

  const uncertainBody =
    editor.uncertain?.kind === "create"
      ? locale.reconcileCreateBody
      : editor.uncertain?.kind === "status"
        ? locale.reconcileStatusBody
        : editor.uncertain?.kind === "cancel"
          ? locale.reconcileCancelBody
          : locale.reconcileUpdateBody;

  return (
    <ProviderWorkspaceDialog
      title={title}
      subtitle={subtitle}
      disableClose={busy}
      restoreFocusFallbackId="availability-title"
      onClose={onClose}
    >
      <div className={styles.editorForm}>
        <p className={styles.notice}>{locale.note}</p>

        {!canManageResources && (
          <p className={styles.notice}>{locale.readonlyNotice}</p>
        )}

        {isEdit && started && (
          <p className={styles.notice}>
            {formatMessage(locale.startedNotice, {
              date: formatAvailabilityDate(slot.slotDate),
              start: formatTimeHhMm(slot.startTime),
            })}
          </p>
        )}

        {isEdit && bookedLocked && (
          <p className={styles.notice}>
            {formatMessage(locale.bookedLockedNotice, {
              booked: slot.bookedCount,
            })}
          </p>
        )}

        {editor.uncertain && (
          <div className={styles.reconcileBox} role="alert">
            <div className={styles.reconcileHeading}>
              <AlertTriangle aria-hidden="true" focusable="false" size={16} />
              <strong>{locale.reconcileTitle}</strong>
            </div>
            <p>{uncertainBody}</p>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={busy || locked || cooldownSeconds > 0}
                onClick={onReconcile}
              >
                <RefreshCw aria-hidden="true" focusable="false" size={14} />
                {editor.reconciling ? locale.reconciling : locale.reconcileAction}
              </button>
            </div>
          </div>
        )}

        {editor.reconcileNote && (
          <p className={styles.notice} role="status">
            {editor.reconcileNote}
          </p>
        )}

        {servicesStatus === "error" && (
          <div className={styles.error} role="alert">
            <p>
              {servicesError
                ? getProviderErrorMessage(servicesError, cooldownSeconds)
                : locale.servicesError}
            </p>
            <button
              type="button"
              className={styles.outlineButton}
              disabled={busy || cooldownSeconds > 0}
              onClick={onReloadServices}
            >
              <RefreshCw aria-hidden="true" focusable="false" size={14} />
              {locale.reloadServices}
            </button>
          </div>
        )}

        {noActiveServicesForCreate && (
          <div className={styles.warningBox}>
            <strong>{locale.noActiveServicesTitle}</strong>
            <p>{locale.noActiveServicesBody}</p>
            <Link
              href="/dashboard/services"
              prefetch={false}
              className={styles.textButton}
            >
              {locale.goToServices}
            </Link>
          </div>
        )}

        <form className={styles.formFields} noValidate onSubmit={handleSubmit}>
          <fieldset
            className={styles.formFields}
            disabled={
              !canManageResources ||
              busy ||
              locked ||
              editor.uncertain !== null ||
              scheduleLocked ||
              noActiveServicesForCreate
            }
          >
            <label className={styles.fieldLabel}>
              {locale.service}
              <select
                id="slot-field-serviceId"
                value={editor.draft.serviceId}
                aria-invalid={Boolean(editor.errors.serviceId) || undefined}
                onChange={(event) =>
                  onChangeField("serviceId", event.target.value)
                }
                required
              >
                <option value="">
                  {servicesStatus === "loading"
                    ? locale.servicesLoading
                    : locale.chooseService}
                </option>
                {showInactiveCurrentOption && resolvedExistingService && (
                  <option value={resolvedExistingService.id}>
                    {formatMessage(locale.serviceOptionInactive, {
                      serviceName: resolvedExistingService.name,
                      minutes: resolvedExistingService.durationMinutes,
                    })}
                  </option>
                )}
                {activeServices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatMessage(locale.serviceOption, {
                      serviceName: item.name,
                      minutes: item.durationMinutes,
                    })}
                  </option>
                ))}
              </select>
              {editor.errors.serviceId && (
                <span className={styles.fieldError} role="alert">
                  {editor.errors.serviceId}
                </span>
              )}
            </label>

            {showInactiveCurrentOption && (
              <p className={styles.hint}>{locale.inactiveServiceEditHint}</p>
            )}

            <label className={styles.fieldLabel}>
              {locale.date}
              <input
                id="slot-field-slotDate"
                type="date"
                value={editor.draft.slotDate}
                min={scheduleLocked ? undefined : localDate(now)}
                aria-invalid={Boolean(editor.errors.slotDate) || undefined}
                onChange={(event) =>
                  onChangeField("slotDate", event.target.value)
                }
                required
              />
              {editor.errors.slotDate && (
                <span className={styles.fieldError} role="alert">
                  {editor.errors.slotDate}
                </span>
              )}
            </label>

            <div className={styles.rangeRow}>
              <label className={styles.fieldLabel}>
                {locale.startLabel}
                <input
                  id="slot-field-startTime"
                  type="time"
                  value={editor.draft.startTime}
                  aria-invalid={Boolean(editor.errors.startTime) || undefined}
                  onChange={(event) =>
                    onChangeField("startTime", event.target.value)
                  }
                  required
                />
                {editor.errors.startTime && (
                  <span className={styles.fieldError} role="alert">
                    {editor.errors.startTime}
                  </span>
                )}
              </label>

              <label className={styles.fieldLabel}>
                {locale.endLabel}
                <input
                  id="slot-field-endTime"
                  type="time"
                  value={editor.draft.endTime}
                  aria-invalid={Boolean(editor.errors.endTime) || undefined}
                  onChange={(event) =>
                    onChangeField("endTime", event.target.value)
                  }
                  required
                />
                {editor.errors.endTime && (
                  <span className={styles.fieldError} role="alert">
                    {editor.errors.endTime}
                  </span>
                )}
              </label>
            </div>
          </fieldset>

          {!scheduleLocked && suggestedEnd === null && (
            <p className={styles.fieldError} role="alert">
              {locale.overflowMidnightNote}
            </p>
          )}
          {!scheduleLocked &&
            typeof suggestedEnd === "string" &&
            suggestedEnd.length > 0 && (
              <p className={styles.hint}>
                {formatMessage(locale.suggestedEndNote, { end: suggestedEnd })}
              </p>
            )}

          <p className={styles.hint}>
            {dateDayOfWeek === null
              ? locale.hoursHintNoDate
              : selectedService
                ? formatMessage(locale.hoursHintWithDuration, {
                    minutes: selectedService.durationMinutes,
                    day: getDayOfWeekLabel(dateDayOfWeek),
                    ranges: formatRanges(activeHoursForDate),
                  })
                : formatMessage(locale.hoursHint, {
                    day: getDayOfWeekLabel(dateDayOfWeek),
                    ranges: formatRanges(activeHoursForDate),
                  })}
          </p>

          <label className={styles.fieldLabel}>
            {locale.capacity}
            <input
              id="slot-field-capacity"
              type="number"
              min={Math.max(1, slot?.bookedCount ?? 1)}
              step="1"
              value={editor.draft.capacity}
              disabled={
                !canManageResources ||
                busy ||
                locked ||
                editor.uncertain !== null ||
                noActiveServicesForCreate
              }
              aria-invalid={Boolean(editor.errors.capacity) || undefined}
              onChange={(event) =>
                onChangeField("capacity", event.target.value)
              }
              required
            />
            {editor.errors.capacity && (
              <span className={styles.fieldError} role="alert">
                {editor.errors.capacity}
              </span>
            )}
          </label>

          {isEdit && (
            <p className={styles.hint}>
              {slot.status !== "OPEN"
                ? formatMessage(locale.capacityNonOpenHint, {
                    booked: slot.bookedCount,
                    capacity: slot.capacity,
                  })
                : remainingSeats === 0
                  ? formatMessage(locale.capacityFullHint, {
                      booked: slot.bookedCount,
                      capacity: slot.capacity,
                    })
                  : formatMessage(locale.capacityHint, {
                      booked: slot.bookedCount,
                      capacity: slot.capacity,
                      remaining: remainingSeats,
                    })}
            </p>
          )}

          {editor.errors.form && (
            <p className={styles.error} role="alert">
              {editor.errors.form}
            </p>
          )}

          {editor.saveError && (
            <p className={styles.error} role="alert">
              {getProviderErrorMessage(editor.saveError, cooldownSeconds)}
            </p>
          )}

          {canManageResources && (
            <>
              {isEdit && !hasChanges && (
                <p className={styles.hint}>{locale.noChangesHint}</p>
              )}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    interactionsLocked || noActiveServicesForCreate || !hasChanges
                  }
                >
                  {editor.saving
                    ? locale.saving
                    : isEdit
                      ? locale.save
                      : locale.createSubmit}
                </button>
              </div>
            </>
          )}
        </form>

        {isEdit && (
          <section className={styles.dangerArea}>
            <h3 className={styles.subHeading}>{locale.statusActionsTitle}</h3>

            {editor.statusFeedback && (
              <p className={styles.success} role="status">
                {editor.statusFeedback}
              </p>
            )}

            {editor.statusError && (
              <p className={styles.error} role="alert">
                {getProviderErrorMessage(editor.statusError, cooldownSeconds)}
              </p>
            )}

            {canManageResources && (
              <div className={styles.formActions}>
                {slot.status === "OPEN" && (
                  <button
                    type="button"
                    className={styles.outlineButton}
                    disabled={interactionsLocked}
                    onClick={() => onRequestStatusAction("close")}
                  >
                    {locale.close}
                  </button>
                )}

                {(slot.status === "CLOSED" || slot.status === "CANCELLED") && (
                  <div className={styles.actionWithHint}>
                    <button
                      type="button"
                      className={styles.outlineButton}
                      disabled={
                        interactionsLocked || !reopenDecision?.allowed
                      }
                      aria-describedby={
                        reopenDecision && !reopenDecision.allowed
                          ? "slot-reopen-reason"
                          : undefined
                      }
                      onClick={() => onRequestStatusAction("reopen")}
                    >
                      {locale.reopen}
                    </button>
                    {reopenDecision && !reopenDecision.allowed && (
                      <p id="slot-reopen-reason" className={styles.hint}>
                        {reopenDecision.reason}
                      </p>
                    )}
                  </div>
                )}

                {slot.status !== "CANCELLED" && (
                  <button
                    type="button"
                    className={styles.dangerOutlineButton}
                    disabled={interactionsLocked}
                    onClick={() => onRequestStatusAction("cancel")}
                  >
                    {locale.cancel}
                  </button>
                )}
              </div>
            )}

            {editor.confirmAction && canManageResources && (
              <div className={styles.confirmation}>
                <p>
                  {formatMessage(
                    editor.confirmAction === "close"
                      ? locale.closePrompt
                      : editor.confirmAction === "reopen"
                        ? locale.reopenPrompt
                        : locale.cancelPrompt,
                    {
                      date: formatAvailabilityDate(slot.slotDate),
                      start: formatTimeHhMm(slot.startTime),
                      end: formatTimeHhMm(slot.endTime),
                    },
                  )}
                </p>

                {(editor.confirmAction === "close" ||
                  editor.confirmAction === "cancel") &&
                  slot.bookedCount > 0 && (
                    <div className={styles.warningBox}>
                      <p>
                        {formatMessage(locale.bookedStatusWarning, {
                          booked: slot.bookedCount,
                        })}
                      </p>
                      <Link
                        href="/dashboard/bookings"
                        prefetch={false}
                        className={styles.textButton}
                      >
                        {locale.viewBookingsLink}
                      </Link>
                    </div>
                  )}

                {editor.confirmAction === "reopen" &&
                  reopenDecision?.allowed &&
                  reopenDecision.serviceInactiveWarning && (
                    <p className={styles.notice}>
                      {locale.reopenInactiveServiceWarning}
                    </p>
                  )}

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={
                      editor.confirmAction === "cancel"
                        ? styles.dangerButton
                        : styles.primaryButton
                    }
                    disabled={interactionsLocked}
                    onClick={onConfirmStatusAction}
                  >
                    {editor.updatingStatus
                      ? editor.confirmAction === "close"
                        ? locale.closing
                        : editor.confirmAction === "reopen"
                          ? locale.reopening
                          : locale.cancelling
                      : editor.confirmAction === "close"
                        ? locale.confirmClose
                        : editor.confirmAction === "reopen"
                          ? locale.confirmReopen
                          : locale.confirmCancel}
                  </button>
                  <button
                    type="button"
                    className={styles.softButton}
                    disabled={busy}
                    onClick={onCancelStatusAction}
                  >
                    {locale.keep}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {isEdit && (
          <section className={styles.seatsSummaryBox}>
            <h3 className={styles.subHeading}>{locale.seatsSummaryTitle}</h3>
            <p>
              <strong>
                {formatMessage(locale.seatsSummaryBooked, {
                  booked: slot.bookedCount,
                  capacity: slot.capacity,
                })}
              </strong>
              {slot.status === "OPEN" && !started && (
                <>
                  {" · "}
                  {formatMessage(locale.seatsSummaryRemaining, {
                    remaining: remainingSeats,
                  })}
                </>
              )}
            </p>
            <p className={styles.hint}>{locale.seatsSummaryNote}</p>
            <Link
              href="/dashboard/bookings"
              prefetch={false}
              className={styles.textButton}
            >
              {locale.viewBookingsLink}
            </Link>
          </section>
        )}

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.softButton}
            disabled={busy}
            onClick={onClose}
          >
            {vi.common.actions.close}
          </button>
        </div>
      </div>
    </ProviderWorkspaceDialog>
  );
}
