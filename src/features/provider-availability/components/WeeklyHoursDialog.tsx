"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import ProviderWorkspaceDialog from "@/features/provider-workspace/components/ProviderWorkspaceDialog";
import { normalizeTimeToHhMm } from "@/features/provider-workspace/liveApi";
import {
  DISPLAY_WEEKDAYS,
  findAffectedBookedSlotsForWorkingHourChange,
  findExactInactiveWorkingHour,
  formatTimeHhMm,
  formatTimeInterval,
  getDayOfWeekLabel,
  groupWorkingHoursByDay,
  hasWorkingHourDraftChanges,
  timeToSeconds,
} from "../availabilityLogic";
import type {
  DayOfWeek,
  ProviderAvailabilitySlot,
  ProviderWorkingHour,
  WorkingHourFieldKey,
  WorkingHoursDialogState,
} from "../types";
import AvailabilityFeedback from "./AvailabilityFeedback";
import styles from "../availability.module.css";

export default function WeeklyHoursDialog({
  editor,
  workingHours,
  slots,
  canManageResources,
  busy,
  locked,
  cooldownSeconds,
  now,
  onChangeField,
  onStartEdit,
  onCancelEdit,
  onSave,
  onRequestDeactivate,
  onCancelDeactivate,
  onConfirmDeactivate,
  onReactivate,
  onReconcile,
  onClose,
}: {
  editor: WorkingHoursDialogState;
  workingHours: readonly ProviderWorkingHour[];
  slots: readonly ProviderAvailabilitySlot[];
  canManageResources: boolean;
  busy: boolean;
  locked: boolean;
  cooldownSeconds: number;
  now: string;
  onChangeField: (field: WorkingHourFieldKey, value: string | DayOfWeek) => void;
  onStartEdit: (hour: ProviderWorkingHour) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onRequestDeactivate: (workingHourId: string) => void;
  onCancelDeactivate: () => void;
  onConfirmDeactivate: (workingHourId: string) => void;
  onReactivate: (hour: ProviderWorkingHour) => void;
  onReconcile: () => void;
  onClose: () => void;
}) {
  const locale = vi.provider.availability.weekly;
  const days = groupWorkingHoursByDay(workingHours);
  const inactiveShifts = days.flatMap((day) => day.inactive);
  const editingHour =
    editor.mode === "edit" && editor.editingId
      ? workingHours.find((item) => item.id === editor.editingId) ?? null
      : null;

  const interactionsLocked =
    !canManageResources ||
    busy ||
    locked ||
    editor.uncertain !== null ||
    cooldownSeconds > 0;

  const hasChanges =
    editor.mode === "edit" && editingHour !== null
      ? hasWorkingHourDraftChanges(editingHour, editor.draft)
      : true;

  const normStart = normalizeTimeToHhMm(editor.draft.startTime);
  const normEnd = normalizeTimeToHhMm(editor.draft.endTime);
  const draftRangeValid =
    normStart !== null &&
    normEnd !== null &&
    (timeToSeconds(normEnd) ?? 0) > (timeToSeconds(normStart) ?? 0);

  const willReactivateInactive =
    editor.mode === "create" && draftRangeValid && normStart && normEnd
      ? findExactInactiveWorkingHour(
          {
            dayOfWeek: editor.draft.dayOfWeek,
            startTime: normStart,
            endTime: normEnd,
          },
          workingHours,
        )
      : null;

  const editAffectedBookedSlots =
    editor.mode === "edit" &&
    editingHour !== null &&
    hasChanges &&
    draftRangeValid &&
    normStart &&
    normEnd
      ? findAffectedBookedSlotsForWorkingHourChange(
          editingHour,
          {
            id: editingHour.id,
            dayOfWeek: editor.draft.dayOfWeek,
            startTime: normStart,
            endTime: normEnd,
            isActive: true,
          },
          workingHours,
          slots,
          now,
        )
      : [];

  const editAffectedBookedTotal = editAffectedBookedSlots.reduce(
    (sum, item) => sum + item.bookedCount,
    0,
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasChanges || interactionsLocked) return;
    onSave();
  }

  const uncertainBody =
    editor.uncertain?.kind === "create"
      ? locale.reconcileCreateBody
      : editor.uncertain?.kind === "deactivate"
        ? locale.reconcileDeactivateBody
        : locale.reconcileUpdateBody;

  return (
    <ProviderWorkspaceDialog
      title={locale.dialogTitle}
      subtitle={locale.dialogSubtitle}
      disableClose={busy}
      restoreFocusFallbackId="availability-title"
      onClose={onClose}
    >
      <div className={styles.editorForm}>
        {!canManageResources && (
          <p className={styles.notice}>{locale.readonlyNotice}</p>
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

        {editor.error && (
          <div className={styles.error} role="alert">
            <p>{getProviderErrorMessage(editor.error, cooldownSeconds)}</p>
            {editor.error.code === "WORKING_HOUR_HAS_ACTIVE_BOOKINGS" && (
              <p className={styles.alertLinkRow}>
                <Link
                  href="/dashboard/bookings"
                  prefetch={false}
                  className={styles.textButton}
                >
                  {locale.activeBookingsLink}
                </Link>
              </p>
            )}
          </div>
        )}

        <AvailabilityFeedback feedback={editor.inlineFeedback} focus={false} />

        {canManageResources && (
          <form className={styles.shiftForm} noValidate onSubmit={handleSubmit}>
            <h3 className={styles.subHeading}>
              {editingHour
                ? formatMessage(locale.editShiftTitle, {
                    day: getDayOfWeekLabel(editingHour.dayOfWeek),
                    start: formatTimeHhMm(editingHour.startTime),
                    end: formatTimeHhMm(editingHour.endTime),
                  })
                : locale.addShiftTitle}
            </h3>

            <fieldset
              className={styles.formFields}
              disabled={busy || locked || editor.uncertain !== null}
            >
              <label className={styles.fieldLabel}>
                {locale.dayField}
                <select
                  id="working-hour-field-dayOfWeek"
                  value={String(editor.draft.dayOfWeek)}
                  aria-invalid={Boolean(editor.errors.dayOfWeek) || undefined}
                  onChange={(event) =>
                    onChangeField(
                      "dayOfWeek",
                      Number(event.target.value) as DayOfWeek,
                    )
                  }
                >
                  {DISPLAY_WEEKDAYS.map((day) => (
                    <option key={day} value={String(day)}>
                      {getDayOfWeekLabel(day)}
                    </option>
                  ))}
                </select>
                {editor.errors.dayOfWeek && (
                  <span className={styles.fieldError} role="alert">
                    {editor.errors.dayOfWeek}
                  </span>
                )}
              </label>

              <div className={styles.rangeRow}>
                <label className={styles.fieldLabel}>
                  {locale.startField}
                  <input
                    id="working-hour-field-startTime"
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
                  {locale.endField}
                  <input
                    id="working-hour-field-endTime"
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

            {editor.errors.form && (
              <p className={styles.error} role="alert">
                {editor.errors.form}
              </p>
            )}

            {willReactivateInactive && !editor.errors.form && (
              <p className={styles.notice}>{locale.reactivateHint}</p>
            )}

            {editAffectedBookedSlots.length > 0 && (
              <div className={styles.warningBox}>
                <p>
                  {formatMessage(locale.affectedBookedWarning, {
                    count: editAffectedBookedSlots.length,
                    booked: editAffectedBookedTotal,
                  })}
                </p>
                <Link
                  href="/dashboard/bookings"
                  prefetch={false}
                  className={styles.textButton}
                >
                  {locale.activeBookingsLink}
                </Link>
              </div>
            )}

            {editingHour && !hasChanges && (
              <p className={styles.hint}>{locale.noChangesHint}</p>
            )}

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={interactionsLocked || !hasChanges}
              >
                {editor.saving
                  ? locale.saving
                  : editingHour
                    ? locale.saveShift
                    : locale.addShift}
              </button>
              {editingHour && (
                <button
                  type="button"
                  className={styles.softButton}
                  disabled={busy}
                  onClick={onCancelEdit}
                >
                  {locale.cancelEdit}
                </button>
              )}
            </div>
          </form>
        )}

        <div className={styles.shiftDayGroups}>
          {days.map((day) => (
            <div key={day.dayOfWeek} className={styles.shiftDayGroup}>
              <div className={styles.shiftDayHeader}>
                <strong>{day.label}</strong>
                <span
                  className={`${styles.badge} ${
                    day.active.length > 0 ? styles.open : styles.closed
                  }`}
                >
                  {day.active.length > 0 ? locale.open : locale.closed}
                </span>
              </div>

              {day.active.length === 0 ? (
                <p className={styles.hint}>{locale.noActiveShifts}</p>
              ) : (
                <ul className={styles.shiftRowList}>
                  {day.active.map((shift) => {
                    const isConfirming = editor.confirmDeactivateId === shift.id;
                    const isMutatingRow = editor.mutatingRowId === shift.id;
                    const deactivateAffected = isConfirming
                      ? findAffectedBookedSlotsForWorkingHourChange(
                          shift,
                          { ...shift, isActive: false },
                          workingHours,
                          slots,
                          now,
                        )
                      : [];
                    const deactivateBookedTotal = deactivateAffected.reduce(
                      (sum, item) => sum + item.bookedCount,
                      0,
                    );

                    return (
                      <li key={shift.id} className={styles.shiftRowItem}>
                        <div className={styles.shiftRowMain}>
                          <span>
                            {formatTimeInterval(shift.startTime, shift.endTime)}
                          </span>
                          {canManageResources && (
                            <div className={styles.shiftRowActions}>
                              <button
                                type="button"
                                className={styles.textButton}
                                disabled={interactionsLocked}
                                onClick={() => onStartEdit(shift)}
                              >
                                {locale.editAction}
                              </button>
                              <button
                                type="button"
                                className={styles.dangerTextButton}
                                disabled={interactionsLocked}
                                onClick={() => onRequestDeactivate(shift.id)}
                              >
                                {isMutatingRow
                                  ? locale.deactivating
                                  : locale.deactivateAction}
                              </button>
                            </div>
                          )}
                        </div>

                        {isConfirming && canManageResources && (
                          <div className={styles.confirmation}>
                            <p>
                              {formatMessage(locale.confirmDeactivate, {
                                day: day.label,
                                start: formatTimeHhMm(shift.startTime),
                                end: formatTimeHhMm(shift.endTime),
                              })}
                            </p>
                            {deactivateAffected.length > 0 && (
                              <div className={styles.warningBox}>
                                <p>
                                  {formatMessage(locale.affectedBookedWarning, {
                                    count: deactivateAffected.length,
                                    booked: deactivateBookedTotal,
                                  })}
                                </p>
                                <Link
                                  href="/dashboard/bookings"
                                  prefetch={false}
                                  className={styles.textButton}
                                >
                                  {locale.activeBookingsLink}
                                </Link>
                              </div>
                            )}
                            <div className={styles.formActions}>
                              <button
                                type="button"
                                className={styles.dangerButton}
                                disabled={interactionsLocked}
                                onClick={() => onConfirmDeactivate(shift.id)}
                              >
                                {isMutatingRow
                                  ? locale.deactivating
                                  : locale.confirmDeactivateButton}
                              </button>
                              <button
                                type="button"
                                className={styles.softButton}
                                disabled={busy}
                                onClick={onCancelDeactivate}
                              >
                                {locale.keepShift}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {inactiveShifts.length > 0 && (
          <details className={styles.inactiveDetails}>
            <summary>
              {formatMessage(locale.inactiveSectionTitle, {
                count: inactiveShifts.length,
              })}
            </summary>
            <p className={styles.hint}>{locale.inactiveSectionHint}</p>
            <ul className={styles.shiftRowList}>
              {inactiveShifts.map((shift) => {
                const isMutatingRow = editor.mutatingRowId === shift.id;
                return (
                  <li key={shift.id} className={styles.shiftRowItem}>
                    <div className={styles.shiftRowMain}>
                      <span>
                        {getDayOfWeekLabel(shift.dayOfWeek)} ·{" "}
                        {formatTimeInterval(shift.startTime, shift.endTime)}
                      </span>
                      {canManageResources && (
                        <button
                          type="button"
                          className={styles.textButton}
                          disabled={interactionsLocked}
                          onClick={() => onReactivate(shift)}
                        >
                          {isMutatingRow
                            ? locale.reactivating
                            : locale.reactivateAction}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
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
