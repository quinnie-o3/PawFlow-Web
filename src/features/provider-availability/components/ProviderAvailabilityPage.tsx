"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { isRequestCancelled } from "@/lib/api/errors";
import { formatMessage, vi } from "@/lib/locale";
import {
  classifyProviderError,
  createAvailabilitySlot,
  createWorkingHour,
  deactivateAvailabilitySlot,
  deactivateWorkingHour,
  updateAvailabilitySlot,
  updateWorkingHour,
  type DayOfWeek,
  type ProviderApiErrorInfo,
  type ProviderAvailabilitySlot,
  type ProviderWorkingHour,
} from "@/features/provider-workspace/liveApi";
import {
  getProviderErrorMessage,
  getProviderErrorMessageByCode,
} from "@/features/provider-workspace/lifecycle";
import { useProviderProfile } from "@/features/provider-workspace/useProviderProfile";
import ProviderLifecycleBanner from "@/features/provider-workspace/components/ProviderLifecycleBanner";
import {
  applyLocalSlotMutation,
  applyLocalWorkingHourMutation,
  buildCreateSlotPayload,
  buildUpdateSlotPatch,
  buildWorkingHourMutationPlan,
  canReopenSlot,
  formatTimeHhMm,
  getDayOfWeekLabel,
  groupWorkingHoursByDay,
  localDate,
  reconcileSlotCancel,
  reconcileSlotCreate,
  reconcileSlotUpdate,
  reconcileWorkingHourCreate,
  reconcileWorkingHourDeactivate,
  reconcileWorkingHourUpdate,
  slotToDraft,
  suggestSlotEndTime,
  summarizeAvailability,
  validateSlotDraft,
  validateWorkingHourDraft,
  workingHourToDraft,
} from "../availabilityLogic";
import { useProviderAvailability } from "../useProviderAvailability";
import type {
  AvailabilityFeedback as AvailabilityFeedbackData,
  SlotEditorState,
  SlotFieldKey,
  SlotStatusAction,
  WorkingHourFieldKey,
  WorkingHoursDialogState,
} from "../types";
import AvailabilityFeedback from "./AvailabilityFeedback";
import AvailabilitySummary from "./AvailabilitySummary";
import ExceptionList from "./ExceptionList";
import SlotDialog from "./SlotDialog";
import SlotsDialog from "./SlotsDialog";
import UpcomingSlots from "./UpcomingSlots";
import WeeklyHoursDialog from "./WeeklyHoursDialog";
import WeeklySchedule from "./WeeklySchedule";
import styles from "../availability.module.css";

type ScopedFeedback = Readonly<{
  identity: string;
  feedback: AvailabilityFeedbackData;
}>;

function lifecycleErrorInfo(
  approvalStatus: "REJECTED" | "SUSPENDED",
): ProviderApiErrorInfo {
  return {
    code:
      approvalStatus === "REJECTED"
        ? "PROVIDER_REJECTED_FORBIDDEN"
        : "PROVIDER_SUSPENDED_FORBIDDEN",
    category: "lifecycle",
    outcome: "definite-failure",
    status: 403,
    retryAfterSeconds: null,
    shouldReconcile: false,
  };
}

export default function ProviderAvailabilityPage() {
  const profileState = useProviderProfile();
  const { sessionBoundary, status: profileStatus, profile, permissions } =
    profileState;

  const availabilityState = useProviderAvailability({
    identity: sessionBoundary.identity,
    canFetchPrivate: sessionBoundary.canFetchPrivate,
    hidePrivateData: sessionBoundary.hidePrivateData,
    resetPrivateState: sessionBoundary.resetPrivateState,
    profileReady: profileStatus === "ready" && profile !== null,
    onProfileNotFound: profileState.markNotFound,
  });

  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [workingDialog, setWorkingDialog] =
    useState<WorkingHoursDialogState | null>(null);
  const [slotEditor, setSlotEditor] = useState<SlotEditorState | null>(null);
  const [slotsDialogIdentity, setSlotsDialogIdentity] = useState<string | null>(
    null,
  );
  const [scopedFeedback, setScopedFeedback] = useState<ScopedFeedback | null>(
    null,
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  // Single shared synchronous lock across all working-hour, slot, and reconcile operations.
  const submittingRef = useRef(false);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const currentIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdentityRef.current = sessionBoundary.identity;
  }, [sessionBoundary.identity]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      mutationControllerRef.current?.abort();
      mutationControllerRef.current = null;
    };
  }, []);

  // Purge all private dialog/draft state asynchronously on 401/logout/identity switch.
  // Keep workingDialog, slotEditor, and uncertain states in memory on same-identity revalidate error.
  useEffect(() => {
    if (!sessionBoundary.resetPrivateState) return;
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = null;
    submittingRef.current = false;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setWorkingDialog(null);
      setSlotEditor(null);
      setSlotsDialogIdentity(null);
      setScopedFeedback(null);
      setCooldownUntil(null);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionBoundary.resetPrivateState]);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const target = cooldownUntil;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= target) {
        window.clearInterval(timer);
      }
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownUntil]);

  function startCooldown(seconds: number | null) {
    if (!seconds || seconds <= 0) return;
    const now = Date.now();
    setNowMs(now);
    setCooldownUntil(now + seconds * 1000);
  }

  const cooldownSeconds =
    cooldownUntil !== null && cooldownUntil > nowMs
      ? Math.ceil((cooldownUntil - nowMs) / 1000)
      : 0;

  const activeWorkingDialog =
    workingDialog !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    workingDialog.identity === sessionBoundary.identity
      ? workingDialog
      : null;

  const activeSlotEditor =
    slotEditor !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    slotEditor.identity === sessionBoundary.identity
      ? slotEditor
      : null;

  const activeSlotsListOpen =
    slotsDialogIdentity !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    slotsDialogIdentity === sessionBoundary.identity;

  const activeFeedback =
    scopedFeedback !== null &&
    !sessionBoundary.hidePrivateData &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    scopedFeedback.identity === sessionBoundary.identity
      ? scopedFeedback.feedback
      : null;

  const canManageResources = Boolean(permissions?.canManageResources);
  const profileReady = profileStatus === "ready" && profile !== null;

  const editingSlot: ProviderAvailabilitySlot | null =
    activeSlotEditor?.mode === "edit" && activeSlotEditor.slotId
      ? availabilityState.slots.find(
          (item) => item.id === activeSlotEditor.slotId,
        ) ?? null
      : null;

  const busy = Boolean(
    activeWorkingDialog?.saving ||
      (activeWorkingDialog !== null &&
        activeWorkingDialog.mutatingRowId !== null) ||
      activeWorkingDialog?.reconciling ||
      activeSlotEditor?.saving ||
      activeSlotEditor?.updatingStatus ||
      activeSlotEditor?.reconciling,
  );

  // Unmount all <ProviderWorkspaceDialog> instances whenever private UI is hidden
  // (including same-identity revalidate error) to release top-layer backdrop/scroll lock,
  // while retaining drafts and uncertain state in memory for the same identity.
  const canRenderDialogs =
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    profileReady;

  const showWorkingDialog = canRenderDialogs && activeWorkingDialog !== null;
  const showSlotDialog =
    canRenderDialogs &&
    activeSlotEditor !== null &&
    (activeSlotEditor.mode === "create" || editingSlot !== null);
  const showSlotsDialog =
    canRenderDialogs &&
    activeSlotsListOpen &&
    !showSlotDialog &&
    !showWorkingDialog;

  const groupedDays = groupWorkingHoursByDay(availabilityState.workingHours);
  const summary = summarizeAvailability(
    availabilityState.workingHours,
    availabilityState.slots,
    availabilityState.services,
    nowIso,
  );

  function setPageFeedback(
    identity: string,
    outcome: "success" | "error",
    message: string,
  ) {
    setScopedFeedback({ identity, feedback: { outcome, message } });
  }

  function openWorkingHoursDialog() {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    setScopedFeedback(null);
    setSlotEditor(null);
    setSlotsDialogIdentity(null);
    setWorkingDialog({
      identity: sessionBoundary.identity,
      mode: "create",
      editingId: null,
      draft: workingHourToDraft(null, 1),
      errors: {},
      saving: false,
      mutatingRowId: null,
      confirmDeactivateId: null,
      reconciling: false,
      error: null,
      uncertain: null,
      reconcileNote: null,
      inlineFeedback: null,
    });
  }

  function closeWorkingHoursDialog() {
    if (submittingRef.current) return;
    setWorkingDialog(null);
  }

  function openSlotsDialog() {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    setScopedFeedback(null);
    setWorkingDialog(null);
    setSlotEditor(null);
    setSlotsDialogIdentity(sessionBoundary.identity);
  }

  function closeSlotsDialog() {
    if (submittingRef.current) return;
    setSlotsDialogIdentity(null);
  }

  function openCreateSlot() {
    if (
      submittingRef.current ||
      !profileReady ||
      !canManageResources ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const freshNow = new Date().toISOString();
    setNowIso(freshNow);
    setScopedFeedback(null);
    setWorkingDialog(null);
    setSlotsDialogIdentity(null);
    const firstActive = availabilityState.services.find(
      (item) => item.status === "ACTIVE",
    );
    setSlotEditor({
      identity: sessionBoundary.identity,
      mode: "create",
      slotId: null,
      draft: slotToDraft(null, localDate(freshNow), firstActive?.id ?? ""),
      autoEndTime: true,
      errors: {},
      saving: false,
      updatingStatus: false,
      reconciling: false,
      confirmAction: null,
      saveError: null,
      statusError: null,
      uncertain: null,
      reconcileNote: null,
      statusFeedback: null,
    });
  }

  function openEditSlot(slotId: string) {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const target = availabilityState.slots.find((item) => item.id === slotId);
    if (!target) return;
    setNowIso(new Date().toISOString());
    setScopedFeedback(null);
    setWorkingDialog(null);
    setSlotsDialogIdentity(null);
    setSlotEditor({
      identity: sessionBoundary.identity,
      mode: "edit",
      slotId: target.id,
      draft: slotToDraft(target),
      autoEndTime: false,
      errors: {},
      saving: false,
      updatingStatus: false,
      reconciling: false,
      confirmAction: null,
      saveError: null,
      statusError: null,
      uncertain: null,
      reconcileNote: null,
      statusFeedback: null,
    });
  }

  function closeSlotEditor() {
    if (submittingRef.current) return;
    setSlotEditor(null);
  }

  function handleChangeWorkingHourField(
    field: WorkingHourFieldKey,
    value: string | DayOfWeek,
  ) {
    setWorkingDialog((current) => {
      if (
        !current ||
        current.saving ||
        current.mutatingRowId !== null ||
        current.reconciling ||
        current.uncertain !== null ||
        !canManageResources
      ) {
        return current;
      }
      const nextErrors = { ...current.errors };
      delete nextErrors[field];
      delete nextErrors.form;
      return {
        ...current,
        draft: { ...current.draft, [field]: value },
        errors: nextErrors,
        error: null,
        reconcileNote: null,
        inlineFeedback: null,
      };
    });
  }

  function handleStartEditWorkingHour(hour: ProviderWorkingHour) {
    if (submittingRef.current || !canManageResources) return;
    setWorkingDialog((current) =>
      current && current.uncertain === null
        ? {
            ...current,
            mode: "edit",
            editingId: hour.id,
            draft: workingHourToDraft(hour),
            errors: {},
            confirmDeactivateId: null,
            error: null,
            reconcileNote: null,
            inlineFeedback: null,
          }
        : current,
    );
  }

  function handleCancelEditWorkingHour() {
    if (submittingRef.current) return;
    setWorkingDialog((current) =>
      current
        ? {
            ...current,
            mode: "create",
            editingId: null,
            draft: workingHourToDraft(null, current.draft.dayOfWeek),
            errors: {},
            error: null,
            reconcileNote: null,
          }
        : current,
    );
  }

  function handleChangeSlotField(field: SlotFieldKey, value: string) {
    setSlotEditor((current) => {
      if (
        !current ||
        current.saving ||
        current.updatingStatus ||
        current.reconciling ||
        current.uncertain !== null ||
        !canManageResources
      ) {
        return current;
      }

      const nextDraft = { ...current.draft, [field]: value };
      let nextAutoEndTime = current.autoEndTime;
      if (field === "endTime") {
        nextAutoEndTime = value.trim() === "";
      }

      if (
        (field === "serviceId" || field === "startTime") &&
        (nextAutoEndTime || nextDraft.endTime.trim() === "")
      ) {
        const service = availabilityState.services.find(
          (item) => item.id === nextDraft.serviceId,
        );
        if (service && nextDraft.startTime) {
          const suggested = suggestSlotEndTime(
            nextDraft.startTime,
            service.durationMinutes,
          );
          if (suggested !== null) {
            nextDraft.endTime = suggested;
            nextAutoEndTime = true;
          } else if (nextAutoEndTime) {
            // Never auto-fill an invalid midnight-overflowing value like 24:30.
            nextDraft.endTime = "";
          }
        }
      }

      const nextErrors = { ...current.errors };
      delete nextErrors[field];
      if (field === "serviceId" || field === "startTime") {
        delete nextErrors.endTime;
      }
      delete nextErrors.form;

      return {
        ...current,
        draft: nextDraft,
        autoEndTime: nextAutoEndTime,
        errors: nextErrors,
        saveError: null,
        reconcileNote: null,
      };
    });
  }

  async function handleReloadAll() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    setNowIso(new Date().toISOString());
    const [profileRes, hoursRes, slotsRes, servicesRes] = await Promise.all([
      profileState.reload(),
      profileReady
        ? availabilityState.reloadWorkingHours()
        : Promise.resolve({ ok: false as const, aborted: true as const }),
      profileReady
        ? availabilityState.reloadSlots()
        : Promise.resolve({ ok: false as const, aborted: true as const }),
      profileReady
        ? availabilityState.reloadServices()
        : Promise.resolve({ ok: false as const, aborted: true as const }),
    ]);
    for (const res of [profileRes, hoursRes, slotsRes, servicesRes]) {
      if (!res.ok && !res.aborted) {
        startCooldown(res.error.retryAfterSeconds);
      }
    }
  }

  async function handleRetryWorkingHours() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    const res = await availabilityState.reloadWorkingHours();
    if (!res.ok && !res.aborted) {
      startCooldown(res.error.retryAfterSeconds);
    }
  }

  async function handleRetrySlots() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    const res = await availabilityState.reloadSlots();
    if (!res.ok && !res.aborted) {
      startCooldown(res.error.retryAfterSeconds);
    }
  }

  async function handleReloadServices() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    const res = await availabilityState.reloadServices();
    if (!res.ok && !res.aborted) {
      startCooldown(res.error.retryAfterSeconds);
    }
  }

  async function handleSaveWorkingHour() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeWorkingDialog ||
      !profile ||
      !canManageResources ||
      activeWorkingDialog.uncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const editingHour =
      activeWorkingDialog.mode === "edit" && activeWorkingDialog.editingId
        ? availabilityState.workingHours.find(
            (item) => item.id === activeWorkingDialog.editingId,
          ) ?? null
        : null;
    if (activeWorkingDialog.mode === "edit" && !editingHour) return;

    const validationErrors = validateWorkingHourDraft(
      activeWorkingDialog.draft,
      availabilityState.workingHours,
      editingHour,
    );
    const firstField = (["dayOfWeek", "startTime", "endTime"] as const).find(
      (key) => Boolean(validationErrors[key]),
    );
    if (firstField || validationErrors.form) {
      setWorkingDialog((current) =>
        current ? { ...current, errors: validationErrors } : current,
      );
      if (firstField) {
        window.requestAnimationFrame(() => {
          document.getElementById(`working-hour-field-${firstField}`)?.focus();
        });
      }
      return;
    }

    const plan = buildWorkingHourMutationPlan(
      activeWorkingDialog.draft,
      availabilityState.workingHours,
      editingHour,
    );
    if (!plan) return;

    submittingRef.current = true;
    const attemptIdentity = activeWorkingDialog.identity;
    const preSubmitIds = availabilityState.workingHours.map((item) => item.id);
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setWorkingDialog((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            errors: {},
            saving: true,
            confirmDeactivateId: null,
            error: null,
            reconcileNote: null,
            inlineFeedback: null,
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      let saved: ProviderWorkingHour;
      let successMessage: string;
      const dayLabel = getDayOfWeekLabel(activeWorkingDialog.draft.dayOfWeek);

      if (plan.kind === "create") {
        saved = await createWorkingHour(plan.input, {
          signal: controller.signal,
        });
        successMessage = formatMessage(feedbackLocale.workingHourCreated, {
          day: dayLabel,
          start: formatTimeHhMm(saved.startTime),
          end: formatTimeHhMm(saved.endTime),
        });
      } else if (plan.kind === "reactivate") {
        saved = await updateWorkingHour(plan.workingHourId, plan.input, {
          signal: controller.signal,
        });
        successMessage = formatMessage(feedbackLocale.workingHourReactivated, {
          day: dayLabel,
          start: formatTimeHhMm(saved.startTime),
          end: formatTimeHhMm(saved.endTime),
        });
      } else {
        saved = await updateWorkingHour(plan.workingHourId, plan.input, {
          signal: controller.signal,
        });
        successMessage = formatMessage(feedbackLocale.workingHourUpdated, {
          day: dayLabel,
          start: formatTimeHhMm(saved.startTime),
          end: formatTimeHhMm(saved.endTime),
        });
      }

      if (
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const refreshed = await availabilityState.reloadWorkingHours();
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (!refreshed.ok) {
        availabilityState.applyWorkingHoursLocally((current) =>
          applyLocalWorkingHourMutation(current, {
            kind: plan.kind === "create" ? "create" : "update",
            workingHour: saved,
          }),
        );
      }

      const finalMessage = refreshed.ok
        ? successMessage
        : `${successMessage} ${feedbackLocale.refreshWarning}`;

      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              mode: "create",
              editingId: null,
              draft: workingHourToDraft(null, saved.dayOfWeek),
              errors: {},
              saving: false,
              error: null,
              inlineFeedback: { outcome: "success", message: finalMessage },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const operation =
        plan.kind === "create" ? "create-working-hour" : "update-working-hour";
      const info = classifyProviderError(err, operation);

      if (info.outcome === "session-ended") {
        setWorkingDialog(null);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setWorkingDialog(null);
        return;
      }

      if (info.code === "WORKING_HOUR_NOT_FOUND") {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mode: "create",
                editingId: null,
                saving: false,
                error: info,
              }
            : current,
        );
        void availabilityState.reloadWorkingHours();
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, saving: false, error: info }
            : current,
        );
        void profileState.reload().then((syncResult) => {
          if (!syncResult.ok && !syncResult.aborted) {
            startCooldown(syncResult.error.retryAfterSeconds);
          }
        });
        return;
      }

      if (info.outcome === "unknown") {
        setWorkingDialog((current) => {
          if (!current || current.identity !== attemptIdentity) return current;
          if (plan.kind === "create") {
            return {
              ...current,
              saving: false,
              error: info,
              uncertain: {
                kind: "create",
                preSubmitIds,
                expected: plan.expected,
              },
              reconcileNote: null,
            };
          }
          return {
            ...current,
            saving: false,
            error: info,
            uncertain: {
              kind: plan.kind === "reactivate" ? "reactivate" : "update",
              workingHourId: plan.workingHourId,
              expected: plan.expected,
            },
            reconcileNote: null,
          };
        });
        return;
      }

      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? { ...current, saving: false, error: info }
          : current,
      );
    } finally {
      submittingRef.current = false;
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null;
      }
    }
  }

  async function handleConfirmDeactivateWorkingHour(workingHourId: string) {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeWorkingDialog ||
      !profile ||
      !canManageResources ||
      activeWorkingDialog.uncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const target = availabilityState.workingHours.find(
      (item) => item.id === workingHourId,
    );
    if (!target) return;

    submittingRef.current = true;
    const attemptIdentity = activeWorkingDialog.identity;
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setWorkingDialog((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            mutatingRowId: workingHourId,
            error: null,
            reconcileNote: null,
            inlineFeedback: null,
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      await deactivateWorkingHour(workingHourId, {
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const refreshed = await availabilityState.reloadWorkingHours();
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (!refreshed.ok) {
        availabilityState.applyWorkingHoursLocally((current) =>
          applyLocalWorkingHourMutation(current, {
            kind: "deactivate",
            workingHourId,
          }),
        );
      }

      const successMessage = formatMessage(
        feedbackLocale.workingHourDeactivated,
        {
          day: getDayOfWeekLabel(target.dayOfWeek),
          start: formatTimeHhMm(target.startTime),
          end: formatTimeHhMm(target.endTime),
        },
      );
      const finalMessage = refreshed.ok
        ? successMessage
        : `${successMessage} ${feedbackLocale.refreshWarning}`;

      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              mode: current.editingId === workingHourId ? "create" : current.mode,
              editingId:
                current.editingId === workingHourId ? null : current.editingId,
              mutatingRowId: null,
              confirmDeactivateId: null,
              error: null,
              inlineFeedback: { outcome: "success", message: finalMessage },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, "deactivate-working-hour");
      if (info.outcome === "session-ended") {
        setWorkingDialog(null);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setWorkingDialog(null);
        return;
      }

      if (info.code === "WORKING_HOUR_NOT_FOUND") {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mutatingRowId: null,
                confirmDeactivateId: null,
                error: info,
              }
            : current,
        );
        void availabilityState.reloadWorkingHours();
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mutatingRowId: null,
                confirmDeactivateId: null,
                error: info,
              }
            : current,
        );
        void profileState.reload().then((syncResult) => {
          if (!syncResult.ok && !syncResult.aborted) {
            startCooldown(syncResult.error.retryAfterSeconds);
          }
        });
        return;
      }

      if (info.outcome === "unknown") {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mutatingRowId: null,
                confirmDeactivateId: null,
                error: info,
                uncertain: { kind: "deactivate", workingHourId },
                reconcileNote: null,
              }
            : current,
        );
        return;
      }

      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? { ...current, mutatingRowId: null, error: info }
          : current,
      );
    } finally {
      submittingRef.current = false;
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null;
      }
    }
  }

  async function handleReactivateWorkingHour(hour: ProviderWorkingHour) {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeWorkingDialog ||
      !profile ||
      !canManageResources ||
      activeWorkingDialog.uncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeWorkingDialog.identity;
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setWorkingDialog((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            mutatingRowId: hour.id,
            confirmDeactivateId: null,
            error: null,
            reconcileNote: null,
            inlineFeedback: null,
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      const updated = await updateWorkingHour(
        hour.id,
        { isActive: true },
        { signal: controller.signal },
      );

      if (
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const refreshed = await availabilityState.reloadWorkingHours();
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (!refreshed.ok) {
        availabilityState.applyWorkingHoursLocally((current) =>
          applyLocalWorkingHourMutation(current, {
            kind: "update",
            workingHour: updated,
          }),
        );
      }

      const successMessage = formatMessage(
        feedbackLocale.workingHourReactivated,
        {
          day: getDayOfWeekLabel(hour.dayOfWeek),
          start: formatTimeHhMm(hour.startTime),
          end: formatTimeHhMm(hour.endTime),
        },
      );
      const finalMessage = refreshed.ok
        ? successMessage
        : `${successMessage} ${feedbackLocale.refreshWarning}`;

      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              mutatingRowId: null,
              error: null,
              inlineFeedback: { outcome: "success", message: finalMessage },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, "update-working-hour");
      if (info.outcome === "session-ended") {
        setWorkingDialog(null);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setWorkingDialog(null);
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, mutatingRowId: null, error: info }
            : current,
        );
        void profileState.reload().then((syncResult) => {
          if (!syncResult.ok && !syncResult.aborted) {
            startCooldown(syncResult.error.retryAfterSeconds);
          }
        });
        return;
      }

      if (info.outcome === "unknown") {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mutatingRowId: null,
                error: info,
                uncertain: {
                  kind: "reactivate",
                  workingHourId: hour.id,
                  expected: { isActive: true },
                },
                reconcileNote: null,
              }
            : current,
        );
        return;
      }

      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? { ...current, mutatingRowId: null, error: info }
          : current,
      );
    } finally {
      submittingRef.current = false;
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null;
      }
    }
  }

  async function handleReconcileWorkingHour() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeWorkingDialog?.uncertain ||
      cooldownSeconds > 0
    ) {
      return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeWorkingDialog.identity;
    const uncertain = activeWorkingDialog.uncertain;

    setWorkingDialog((current) =>
      current && current.identity === attemptIdentity
        ? { ...current, reconciling: true, error: null, reconcileNote: null }
        : current,
    );

    const weeklyLocale = vi.provider.availability.weekly;
    const feedbackLocale = vi.provider.availability.feedback;

    try {
      const [hoursRes, profileRes] = await Promise.all([
        availabilityState.reloadWorkingHours(),
        profileState.reload(),
      ]);
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (
        (!profileRes.ok &&
          !profileRes.aborted &&
          (profileRes.error.outcome === "session-ended" ||
            profileRes.error.code === "PROVIDER_PROFILE_NOT_FOUND")) ||
        (!hoursRes.ok &&
          !hoursRes.aborted &&
          (hoursRes.error.outcome === "session-ended" ||
            hoursRes.error.code === "PROVIDER_PROFILE_NOT_FOUND"))
      ) {
        setWorkingDialog(null);
        return;
      }

      if (!hoursRes.ok) {
        if (hoursRes.aborted) {
          setWorkingDialog((current) =>
            current && current.identity === attemptIdentity
              ? { ...current, reconciling: false }
              : current,
          );
          return;
        }
        startCooldown(hoursRes.error.retryAfterSeconds);
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, reconciling: false, error: hoursRes.error }
            : current,
        );
        return;
      }

      const approvalStatus = profileRes.ok
        ? profileRes.profile.approvalStatus
        : profile?.approvalStatus;

      if (uncertain.kind === "create") {
        const res = reconcileWorkingHourCreate(
          uncertain.expected,
          uncertain.preSubmitIds,
          hoursRes.workingHours,
          approvalStatus,
        );
        if (res.outcome === "created") {
          setWorkingDialog((current) =>
            current && current.identity === attemptIdentity
              ? {
                  ...current,
                  mode: "create",
                  editingId: null,
                  draft: workingHourToDraft(null, res.item.dayOfWeek),
                  reconciling: false,
                  uncertain: null,
                  error: null,
                  inlineFeedback: {
                    outcome: "success",
                    message: feedbackLocale.workingHourReconciledCreated,
                  },
                }
              : current,
          );
          setPageFeedback(
            attemptIdentity,
            "success",
            feedbackLocale.workingHourReconciledCreated,
          );
          return;
        }
        if (res.outcome === "forbidden-lifecycle") {
          setWorkingDialog((current) =>
            current && current.identity === attemptIdentity
              ? {
                  ...current,
                  reconciling: false,
                  uncertain: null,
                  error: lifecycleErrorInfo(res.approvalStatus),
                }
              : current,
          );
          return;
        }
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                error: null,
                reconcileNote: weeklyLocale.reconcileNotCreated,
              }
            : current,
        );
        return;
      }

      const res =
        uncertain.kind === "deactivate"
          ? reconcileWorkingHourDeactivate(
              uncertain.workingHourId,
              hoursRes.workingHours,
              approvalStatus,
            )
          : reconcileWorkingHourUpdate(
              uncertain.workingHourId,
              uncertain.expected,
              hoursRes.workingHours,
              approvalStatus,
            );

      if (res.outcome === "saved") {
        const message =
          uncertain.kind === "deactivate"
            ? feedbackLocale.workingHourReconciledDeactivated
            : feedbackLocale.workingHourReconciledUpdated;
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mode: "create",
                editingId: null,
                reconciling: false,
                uncertain: null,
                error: null,
                inlineFeedback: { outcome: "success", message },
              }
            : current,
        );
        setPageFeedback(attemptIdentity, "success", message);
        return;
      }
      if (res.outcome === "not-found") {
        const message = getProviderErrorMessageByCode("WORKING_HOUR_NOT_FOUND");
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                mode: "create",
                editingId: null,
                reconciling: false,
                uncertain: null,
                inlineFeedback: { outcome: "error", message },
              }
            : current,
        );
        return;
      }
      if (res.outcome === "forbidden-lifecycle") {
        setWorkingDialog((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                error: lifecycleErrorInfo(res.approvalStatus),
              }
            : current,
        );
        return;
      }
      setWorkingDialog((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              reconciling: false,
              uncertain: null,
              error: null,
              reconcileNote:
                uncertain.kind === "deactivate"
                  ? weeklyLocale.reconcileNotDeactivated
                  : weeklyLocale.reconcileNotSaved,
            }
          : current,
      );
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleSaveSlot() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeSlotEditor ||
      !profile ||
      !canManageResources ||
      activeSlotEditor.uncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const isEdit = activeSlotEditor.mode === "edit";
    if (isEdit && !editingSlot) return;

    const freshNow = new Date().toISOString();
    setNowIso(freshNow);

    const validationErrors = validateSlotDraft(activeSlotEditor.draft, {
      services: availabilityState.services,
      workingHours: availabilityState.workingHours,
      slots: availabilityState.slots,
      editingSlot: isEdit ? editingSlot : null,
      now: freshNow,
    });

    const firstField = (
      ["serviceId", "slotDate", "startTime", "endTime", "capacity"] as const
    ).find((key) => Boolean(validationErrors[key]));
    if (firstField || validationErrors.form) {
      setSlotEditor((current) =>
        current ? { ...current, errors: validationErrors } : current,
      );
      if (firstField) {
        window.requestAnimationFrame(() => {
          document.getElementById(`slot-field-${firstField}`)?.focus();
        });
      }
      return;
    }

    let createPayload: ReturnType<typeof buildCreateSlotPayload> = null;
    let updatePatch: ReturnType<typeof buildUpdateSlotPatch> | null = null;

    if (isEdit && editingSlot) {
      updatePatch = buildUpdateSlotPatch(
        editingSlot,
        activeSlotEditor.draft,
        freshNow,
      );
      if (Object.keys(updatePatch.input).length === 0) {
        return;
      }
    } else {
      createPayload = buildCreateSlotPayload(activeSlotEditor.draft);
      if (!createPayload) return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeSlotEditor.identity;
    const preSubmitIds = availabilityState.slots.map((item) => item.id);
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setSlotEditor((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            errors: {},
            saving: true,
            confirmAction: null,
            saveError: null,
            statusError: null,
            reconcileNote: null,
            statusFeedback: null,
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      if (isEdit && editingSlot && updatePatch) {
        const updated = await updateAvailabilitySlot(
          editingSlot.id,
          updatePatch.input,
          { signal: controller.signal },
        );
        if (
          controller.signal.aborted ||
          currentIdentityRef.current !== attemptIdentity
        ) {
          return;
        }
        const refreshed = await availabilityState.reloadSlots();
        if (currentIdentityRef.current !== attemptIdentity) return;

        if (!refreshed.ok) {
          availabilityState.applySlotsLocally((current) =>
            applyLocalSlotMutation(
              current,
              { kind: "update", slot: updated },
              availabilityState.services,
            ),
          );
          setSlotEditor(null);
          setPageFeedback(
            attemptIdentity,
            "success",
            `${feedbackLocale.slotUpdated} ${feedbackLocale.refreshWarning}`,
          );
          return;
        }
        setSlotEditor(null);
        setPageFeedback(attemptIdentity, "success", feedbackLocale.slotUpdated);
      } else if (createPayload) {
        const created = await createAvailabilitySlot(createPayload.input, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          currentIdentityRef.current !== attemptIdentity
        ) {
          return;
        }
        const createdMessage =
          profile.approvalStatus === "PENDING"
            ? feedbackLocale.slotCreatedPending
            : feedbackLocale.slotCreated;
        const refreshed = await availabilityState.reloadSlots();
        if (currentIdentityRef.current !== attemptIdentity) return;

        if (!refreshed.ok) {
          availabilityState.applySlotsLocally((current) =>
            applyLocalSlotMutation(
              current,
              { kind: "create", slot: created },
              availabilityState.services,
            ),
          );
          setSlotEditor(null);
          setPageFeedback(
            attemptIdentity,
            "success",
            `${createdMessage} ${feedbackLocale.refreshWarning}`,
          );
          return;
        }
        setSlotEditor(null);
        setPageFeedback(attemptIdentity, "success", createdMessage);
      }
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const operation = isEdit ? "update-availability" : "create-availability";
      const info = classifyProviderError(err, operation);

      if (info.outcome === "session-ended") {
        setSlotEditor(null);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setSlotEditor(null);
        return;
      }

      if (info.code === "SLOT_NOT_FOUND") {
        setSlotEditor(null);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessage(info),
        );
        void availabilityState.reloadSlots();
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, saving: false, saveError: info }
            : current,
        );
        void profileState.reload().then((syncResult) => {
          if (!syncResult.ok && !syncResult.aborted) {
            startCooldown(syncResult.error.retryAfterSeconds);
          }
        });
        return;
      }

      if (info.code === "SERVICE_INACTIVE" || info.code === "SERVICE_NOT_FOUND") {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                saving: false,
                saveError: info,
                errors: {
                  ...current.errors,
                  serviceId: getProviderErrorMessage(info),
                },
              }
            : current,
        );
        void availabilityState.reloadServices();
        return;
      }

      if (info.code === "SLOT_OUTSIDE_WORKING_HOURS") {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, saving: false, saveError: info }
            : current,
        );
        void availabilityState.reloadWorkingHours();
        return;
      }

      if (
        info.code === "SLOT_HAS_BOOKINGS_LOCKED_FIELDS" ||
        info.code === "SLOT_CAPACITY_BELOW_BOOKED"
      ) {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, saving: false, saveError: info }
            : current,
        );
        void availabilityState.reloadSlots();
        return;
      }

      if (info.outcome === "unknown") {
        setSlotEditor((current) => {
          if (!current || current.identity !== attemptIdentity) return current;
          if (isEdit && editingSlot && updatePatch) {
            return {
              ...current,
              saving: false,
              saveError: info,
              uncertain: {
                kind: "update",
                slotId: editingSlot.id,
                expected: updatePatch.expected,
              },
              reconcileNote: null,
            };
          }
          if (createPayload) {
            return {
              ...current,
              saving: false,
              saveError: info,
              uncertain: {
                kind: "create",
                preSubmitIds,
                expected: createPayload.expected,
              },
              reconcileNote: null,
            };
          }
          return { ...current, saving: false, saveError: info };
        });
        return;
      }

      setSlotEditor((current) =>
        current && current.identity === attemptIdentity
          ? { ...current, saving: false, saveError: info }
          : current,
      );
    } finally {
      submittingRef.current = false;
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null;
      }
    }
  }

  function handleRequestSlotStatusAction(action: SlotStatusAction) {
    if (
      submittingRef.current ||
      !canManageResources ||
      sessionBoundary.lockActions
    ) {
      return;
    }
    setSlotEditor((current) => {
      if (
        !current ||
        current.mode !== "edit" ||
        current.saving ||
        current.updatingStatus ||
        current.reconciling ||
        current.uncertain !== null
      ) {
        return current;
      }
      return {
        ...current,
        confirmAction: action,
        statusError: null,
        statusFeedback: null,
        reconcileNote: null,
      };
    });
  }

  function handleCancelSlotStatusAction() {
    if (submittingRef.current) return;
    setSlotEditor((current) =>
      current ? { ...current, confirmAction: null, statusError: null } : current,
    );
  }

  async function handleConfirmSlotStatusAction() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeSlotEditor ||
      activeSlotEditor.mode !== "edit" ||
      activeSlotEditor.confirmAction === null ||
      !editingSlot ||
      !profile ||
      !canManageResources ||
      activeSlotEditor.uncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const action = activeSlotEditor.confirmAction;
    const slotId = editingSlot.id;
    const freshNow = new Date().toISOString();
    setNowIso(freshNow);

    const reopenCheck =
      action === "reopen"
        ? canReopenSlot(
            editingSlot,
            availabilityState.services,
            availabilityState.workingHours,
            freshNow,
          )
        : null;
    if (reopenCheck && !reopenCheck.allowed) {
      setSlotEditor((current) =>
        current
          ? {
              ...current,
              confirmAction: null,
              reconcileNote: reopenCheck.reason,
            }
          : current,
      );
      return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeSlotEditor.identity;
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setSlotEditor((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            updatingStatus: true,
            saveError: null,
            statusError: null,
            reconcileNote: null,
            statusFeedback: null,
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      let updatedSlot: ProviderAvailabilitySlot | null = null;
      if (action === "cancel") {
        await deactivateAvailabilitySlot(slotId, {
          signal: controller.signal,
        });
      } else {
        updatedSlot = await updateAvailabilitySlot(
          slotId,
          { status: action === "close" ? "CLOSED" : "OPEN" },
          { signal: controller.signal },
        );
      }

      if (
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const successMessage =
        action === "cancel"
          ? feedbackLocale.slotCancelled
          : action === "close"
            ? feedbackLocale.slotClosed
            : reopenCheck?.allowed && reopenCheck.serviceInactiveWarning
              ? feedbackLocale.slotReopenedInactiveService
              : profile.approvalStatus === "PENDING"
                ? feedbackLocale.slotReopenedPending
                : feedbackLocale.slotReopened;

      const refreshed = await availabilityState.reloadSlots();
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (!refreshed.ok) {
        availabilityState.applySlotsLocally((current) =>
          action === "cancel"
            ? applyLocalSlotMutation(
                current,
                { kind: "cancel", slotId },
                availabilityState.services,
              )
            : applyLocalSlotMutation(
                current,
                {
                  kind: "update",
                  slot: updatedSlot ?? {
                    ...editingSlot,
                    status: action === "close" ? "CLOSED" : "OPEN",
                  },
                },
                availabilityState.services,
              ),
        );
      }

      const finalMessage = refreshed.ok
        ? successMessage
        : `${successMessage} ${feedbackLocale.refreshWarning}`;

      setSlotEditor((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              updatingStatus: false,
              confirmAction: null,
              statusError: null,
              statusFeedback: finalMessage,
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const operation =
        action === "cancel" ? "deactivate-availability" : "update-availability";
      const info = classifyProviderError(err, operation);

      if (info.outcome === "session-ended") {
        setSlotEditor(null);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setSlotEditor(null);
        return;
      }

      if (info.code === "SLOT_NOT_FOUND") {
        setSlotEditor(null);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessage(info),
        );
        void availabilityState.reloadSlots();
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                updatingStatus: false,
                confirmAction: null,
                statusError: info,
              }
            : current,
        );
        void profileState.reload().then((syncResult) => {
          if (!syncResult.ok && !syncResult.aborted) {
            startCooldown(syncResult.error.retryAfterSeconds);
          }
        });
        return;
      }

      if (info.outcome === "unknown") {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                updatingStatus: false,
                statusError: info,
                uncertain:
                  action === "cancel"
                    ? { kind: "cancel", slotId }
                    : {
                        kind: "status",
                        slotId,
                        targetStatus: action === "close" ? "CLOSED" : "OPEN",
                      },
                reconcileNote: null,
              }
            : current,
        );
        return;
      }

      setSlotEditor((current) =>
        current && current.identity === attemptIdentity
          ? { ...current, updatingStatus: false, statusError: info }
          : current,
      );
    } finally {
      submittingRef.current = false;
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null;
      }
    }
  }

  async function handleReconcileSlot() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeSlotEditor?.uncertain ||
      cooldownSeconds > 0
    ) {
      return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeSlotEditor.identity;
    const uncertain = activeSlotEditor.uncertain;

    setSlotEditor((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            reconciling: true,
            saveError: null,
            statusError: null,
            reconcileNote: null,
          }
        : current,
    );

    const slotLocale = vi.provider.availability.slot;
    const feedbackLocale = vi.provider.availability.feedback;

    try {
      const [slotsRes, profileRes] = await Promise.all([
        availabilityState.reloadSlots(),
        profileState.reload(),
      ]);
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (
        (!profileRes.ok &&
          !profileRes.aborted &&
          (profileRes.error.outcome === "session-ended" ||
            profileRes.error.code === "PROVIDER_PROFILE_NOT_FOUND")) ||
        (!slotsRes.ok &&
          !slotsRes.aborted &&
          (slotsRes.error.outcome === "session-ended" ||
            slotsRes.error.code === "PROVIDER_PROFILE_NOT_FOUND"))
      ) {
        setSlotEditor(null);
        return;
      }

      if (!slotsRes.ok) {
        if (slotsRes.aborted) {
          setSlotEditor((current) =>
            current && current.identity === attemptIdentity
              ? { ...current, reconciling: false }
              : current,
          );
          return;
        }
        startCooldown(slotsRes.error.retryAfterSeconds);
        const isStatusKind =
          uncertain.kind === "status" || uncertain.kind === "cancel";
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                saveError: isStatusKind ? null : slotsRes.error,
                statusError: isStatusKind ? slotsRes.error : null,
              }
            : current,
        );
        return;
      }

      const approvalStatus = profileRes.ok
        ? profileRes.profile.approvalStatus
        : profile?.approvalStatus;

      if (uncertain.kind === "create") {
        const res = reconcileSlotCreate(
          uncertain.expected,
          uncertain.preSubmitIds,
          slotsRes.slots,
          approvalStatus,
        );
        if (res.outcome === "created") {
          setSlotEditor(null);
          setPageFeedback(
            attemptIdentity,
            "success",
            feedbackLocale.slotReconciledCreated,
          );
          return;
        }
        if (res.outcome === "forbidden-lifecycle") {
          setSlotEditor((current) =>
            current && current.identity === attemptIdentity
              ? {
                  ...current,
                  reconciling: false,
                  uncertain: null,
                  saveError: lifecycleErrorInfo(res.approvalStatus),
                }
              : current,
          );
          return;
        }
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                saveError: null,
                reconcileNote: slotLocale.reconcileNotCreated,
              }
            : current,
        );
        return;
      }

      if (uncertain.kind === "update") {
        const res = reconcileSlotUpdate(
          uncertain.slotId,
          uncertain.expected,
          slotsRes.slots,
          approvalStatus,
        );
        if (res.outcome === "saved") {
          setSlotEditor(null);
          setPageFeedback(
            attemptIdentity,
            "success",
            feedbackLocale.slotReconciledUpdated,
          );
          return;
        }
        if (res.outcome === "not-found") {
          setSlotEditor(null);
          setPageFeedback(
            attemptIdentity,
            "error",
            getProviderErrorMessageByCode("SLOT_NOT_FOUND"),
          );
          return;
        }
        if (res.outcome === "forbidden-lifecycle") {
          setSlotEditor((current) =>
            current && current.identity === attemptIdentity
              ? {
                  ...current,
                  reconciling: false,
                  uncertain: null,
                  saveError: lifecycleErrorInfo(res.approvalStatus),
                }
              : current,
          );
          return;
        }
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                saveError: null,
                reconcileNote: slotLocale.reconcileNotSaved,
              }
            : current,
        );
        return;
      }

      const res =
        uncertain.kind === "cancel"
          ? reconcileSlotCancel(
              uncertain.slotId,
              slotsRes.slots,
              approvalStatus,
            )
          : reconcileSlotUpdate(
              uncertain.slotId,
              { status: uncertain.targetStatus },
              slotsRes.slots,
              approvalStatus,
            );

      if (res.outcome === "saved") {
        const message =
          uncertain.kind === "cancel"
            ? feedbackLocale.slotReconciledCancelled
            : feedbackLocale.slotReconciledStatus;
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                confirmAction: null,
                statusError: null,
                statusFeedback: message,
              }
            : current,
        );
        setPageFeedback(attemptIdentity, "success", message);
        return;
      }
      if (res.outcome === "not-found") {
        setSlotEditor(null);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessageByCode("SLOT_NOT_FOUND"),
        );
        return;
      }
      if (res.outcome === "forbidden-lifecycle") {
        setSlotEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                confirmAction: null,
                statusError: lifecycleErrorInfo(res.approvalStatus),
              }
            : current,
        );
        return;
      }
      setSlotEditor((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              reconciling: false,
              uncertain: null,
              statusError: null,
              reconcileNote: slotLocale.reconcileStatusNotSaved,
            }
          : current,
      );
    } finally {
      submittingRef.current = false;
    }
  }

  const pageLocale = vi.provider.availability.page;
  const sessionLocale = vi.provider.workspace.session;
  const isReloadingAny =
    profileState.reloading ||
    availabilityState.workingHoursReloading ||
    availabilityState.slotsReloading ||
    availabilityState.servicesReloading;

  const introDescription =
    profileReady && !sessionBoundary.hidePrivateData
      ? formatMessage(pageLocale.description, {
          facilityName: profile.businessName,
        })
      : pageLocale.descriptionFallback;

  const contextualHint = !profile
    ? pageLocale.liveHint
    : profile.approvalStatus === "PENDING"
      ? pageLocale.pendingHint
      : !canManageResources
        ? pageLocale.readonlyHint
        : pageLocale.liveHint;

  const canCreateSlot =
    profileReady &&
    canManageResources &&
    !sessionBoundary.lockActions &&
    !sessionBoundary.hidePrivateData;

  const canOpenDialogs =
    profileReady &&
    !sessionBoundary.lockActions &&
    !sessionBoundary.hidePrivateData;

  return (
    <div className={styles.page} lang="vi">
      <div className={styles.providerTab}>{pageLocale.providerTab}</div>

      <header className={styles.intro}>
        <div>
          <h1 id="availability-title" tabIndex={-1}>
            {pageLocale.title}
          </h1>
          <p>{introDescription}</p>
        </div>

        {profileReady && !sessionBoundary.hidePrivateData && (
          <div className={styles.introActions}>
            <button
              type="button"
              className={styles.reloadButton}
              disabled={
                isReloadingAny ||
                cooldownSeconds > 0 ||
                sessionBoundary.lockActions
              }
              onClick={() => void handleReloadAll()}
            >
              <RefreshCw aria-hidden="true" focusable="false" size={14} />
              {isReloadingAny ? pageLocale.reloading : pageLocale.reload}
            </button>
            <button
              type="button"
              className={styles.primaryCtaButton}
              disabled={!canCreateSlot || busy}
              onClick={openCreateSlot}
            >
              {vi.provider.availability.slot.create}
            </button>
          </div>
        )}
      </header>

      {sessionBoundary.mode === "session-pending" ? (
        <div
          className={styles.skeletonCard}
          role="status"
          aria-busy="true"
          aria-label={sessionLocale.pending}
        >
          <div className={`${styles.skeletonBar} ${styles.skeletonBarTitle}`} />
          <div className={`${styles.skeletonBar} ${styles.skeletonBarFull}`} />
          <p className={styles.srOnly}>{sessionLocale.pending}</p>
        </div>
      ) : sessionBoundary.mode === "session-error" ? (
        <section
          className={styles.sessionNotice}
          aria-labelledby="availability-session-error"
        >
          <h2 id="availability-session-error">{sessionLocale.errorTitle}</h2>
          <p>{sessionLocale.errorDescription}</p>
        </section>
      ) : sessionBoundary.mode === "unauthenticated" ? (
        <section className={styles.sessionNotice} role="status">
          <p>{sessionLocale.unauthenticated}</p>
        </section>
      ) : sessionBoundary.mode === "wrong-role" ? (
        <section className={styles.sessionNotice} role="alert">
          <p>{sessionLocale.wrongRole}</p>
        </section>
      ) : (
        <>
          <ProviderLifecycleBanner
            status={profileStatus}
            profile={profile}
            error={profileState.error}
            refreshError={profileState.refreshError}
            reloading={profileState.reloading}
            cooldownSeconds={cooldownSeconds}
            onReload={() => void handleReloadAll()}
          />

          {profileReady && (
            <>
              <p className={styles.liveHint}>{contextualHint}</p>

              {(availabilityState.workingHoursRefreshError ||
                availabilityState.slotsRefreshError) && (
                <p className={styles.error} role="alert">
                  {getProviderErrorMessage(
                    (availabilityState.workingHoursRefreshError ??
                      availabilityState.slotsRefreshError)!,
                    cooldownSeconds,
                  )}
                </p>
              )}

              {!showWorkingDialog && !showSlotDialog && !showSlotsDialog && (
                <AvailabilityFeedback feedback={activeFeedback} focus={false} />
              )}

              {availabilityState.workingHoursStatus === "ready" &&
                availabilityState.slotsStatus === "ready" && (
                  <AvailabilitySummary summary={summary} />
                )}

              <div className={styles.scheduleGrid}>
                <WeeklySchedule
                  status={availabilityState.workingHoursStatus}
                  days={groupedDays}
                  error={availabilityState.workingHoursError}
                  reloading={availabilityState.workingHoursReloading}
                  cooldownSeconds={cooldownSeconds}
                  canManageResources={canManageResources}
                  onOpenDialog={openWorkingHoursDialog}
                  onRetry={() => void handleRetryWorkingHours()}
                />
                <ExceptionList
                  canOpenDialogs={canOpenDialogs && !busy}
                  onOpenSlots={openSlotsDialog}
                  onOpenWeekly={openWorkingHoursDialog}
                />
              </div>

              <div className={styles.rulesGrid}>
                <section
                  className={styles.card}
                  aria-labelledby="booking-rules-title"
                >
                  <h2 id="booking-rules-title">
                    {vi.provider.availability.rules.title}
                  </h2>
                  <p>{vi.provider.availability.rules.duration}</p>
                  <p>{vi.provider.availability.rules.capacity}</p>
                  <p>{vi.provider.availability.rules.closedDays}</p>
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={!canOpenDialogs || busy}
                    onClick={openWorkingHoursDialog}
                  >
                    {canManageResources
                      ? vi.provider.availability.weekly.edit
                      : vi.provider.availability.weekly.view}
                  </button>
                  <nav
                    className={styles.slotActions}
                    aria-label={
                      vi.provider.availability.rules.relatedNavigation
                    }
                  >
                    <Link
                      href="/dashboard/services"
                      prefetch={false}
                      className={styles.textButton}
                    >
                      {vi.provider.availability.rules.viewServices}
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      prefetch={false}
                      className={styles.textButton}
                    >
                      {vi.provider.availability.rules.providerProfile}
                    </Link>
                  </nav>
                </section>

                <UpcomingSlots
                  status={availabilityState.slotsStatus}
                  slots={availabilityState.slots}
                  workingHours={availabilityState.workingHours}
                  services={availabilityState.services}
                  error={availabilityState.slotsError}
                  reloading={availabilityState.slotsReloading}
                  cooldownSeconds={cooldownSeconds}
                  now={nowIso}
                  onSelect={openEditSlot}
                  onShowAll={openSlotsDialog}
                  onRetry={() => void handleRetrySlots()}
                />
              </div>

              <div className={styles.slotActions}>
                <button
                  type="button"
                  className={styles.outlineButton}
                  disabled={!canCreateSlot || busy}
                  onClick={openCreateSlot}
                >
                  {vi.provider.availability.slot.create}
                </button>
                <button
                  type="button"
                  className={styles.outlineButton}
                  disabled={
                    !canOpenDialogs ||
                    busy ||
                    availabilityState.slotsStatus !== "ready"
                  }
                  onClick={openSlotsDialog}
                >
                  {formatMessage(pageLocale.manageSlots, {
                    count: availabilityState.slots.length,
                  })}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {showWorkingDialog && activeWorkingDialog && (
        <WeeklyHoursDialog
          editor={activeWorkingDialog}
          workingHours={availabilityState.workingHours}
          slots={availabilityState.slots}
          canManageResources={canManageResources}
          busy={busy}
          locked={sessionBoundary.lockActions}
          cooldownSeconds={cooldownSeconds}
          now={nowIso}
          onChangeField={handleChangeWorkingHourField}
          onStartEdit={handleStartEditWorkingHour}
          onCancelEdit={handleCancelEditWorkingHour}
          onSave={() => void handleSaveWorkingHour()}
          onRequestDeactivate={(workingHourId) =>
            setWorkingDialog((current) =>
              current && current.uncertain === null
                ? {
                    ...current,
                    confirmDeactivateId: workingHourId,
                    error: null,
                    reconcileNote: null,
                  }
                : current,
            )
          }
          onCancelDeactivate={() =>
            setWorkingDialog((current) =>
              current ? { ...current, confirmDeactivateId: null } : current,
            )
          }
          onConfirmDeactivate={(workingHourId) =>
            void handleConfirmDeactivateWorkingHour(workingHourId)
          }
          onReactivate={(hour) => void handleReactivateWorkingHour(hour)}
          onReconcile={() => void handleReconcileWorkingHour()}
          onClose={closeWorkingHoursDialog}
        />
      )}

      {showSlotDialog && activeSlotEditor && (
        <SlotDialog
          editor={activeSlotEditor}
          slot={editingSlot}
          services={availabilityState.services}
          servicesStatus={availabilityState.servicesStatus}
          servicesError={availabilityState.servicesError}
          workingHours={availabilityState.workingHours}
          canManageResources={canManageResources}
          busy={busy}
          locked={sessionBoundary.lockActions}
          cooldownSeconds={cooldownSeconds}
          now={nowIso}
          onChangeField={handleChangeSlotField}
          onReloadServices={() => void handleReloadServices()}
          onSave={() => void handleSaveSlot()}
          onRequestStatusAction={handleRequestSlotStatusAction}
          onCancelStatusAction={handleCancelSlotStatusAction}
          onConfirmStatusAction={() => void handleConfirmSlotStatusAction()}
          onReconcile={() => void handleReconcileSlot()}
          onClose={closeSlotEditor}
        />
      )}

      {showSlotsDialog && (
        <SlotsDialog
          slots={availabilityState.slots}
          services={availabilityState.services}
          workingHours={availabilityState.workingHours}
          canManageResources={canManageResources}
          busy={busy}
          locked={sessionBoundary.lockActions}
          now={nowIso}
          onSelect={openEditSlot}
          onCreate={openCreateSlot}
          onClose={closeSlotsDialog}
        />
      )}
    </div>
  );
}
