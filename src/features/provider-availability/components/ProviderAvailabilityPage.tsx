"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ApiError, isRequestCancelled } from "@/lib/api/errors";
import { formatMessage, vi } from "@/lib/locale";
import { snapshot } from "@/features/session/client";
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
  providerSessionIdentityKey,
} from "@/features/provider-workspace/lifecycle";
import { useProviderProfile } from "@/features/provider-workspace/useProviderProfile";
import ProviderLifecycleBanner from "@/features/provider-workspace/components/ProviderLifecycleBanner";
import {
  INITIAL_SLOT_DIALOG_SESSION,
  INITIAL_WORKING_HOURS_SESSION,
  applyLocalSlotMutation,
  applyLocalWorkingHourMutation,
  buildCreateSlotPayload,
  buildSlotEditorFromPending,
  buildUpdateSlotPatch,
  buildWorkingHourMutationPlan,
  buildWorkingHoursDialogFromPending,
  canReopenSlot,
  closeSlotDialogSession,
  closeWorkingHoursDialogSession,
  enterSlotUncertainSession,
  enterWorkingHoursUncertainSession,
  formatTimeHhMm,
  getDayOfWeekLabel,
  groupWorkingHoursByDay,
  keepSlotUncertainOnLifecycleLock,
  keepWorkingHoursUncertainOnLifecycleLock,
  localDate,
  openCreateSlotDialogSession,
  openEditSlotDialogSession,
  openWorkingHoursDialogSession,
  reconcileSlotCancel,
  reconcileSlotCreate,
  reconcileSlotUpdate,
  reconcileWorkingHourCreate,
  reconcileWorkingHourDeactivate,
  reconcileWorkingHourUpdate,
  recoverAbortedSlotMutation,
  recoverAbortedSlotReconcile,
  recoverAbortedWorkingHoursMutation,
  recoverAbortedWorkingHoursReconcile,
  reopenPendingSlotSession,
  reopenPendingWorkingHoursSession,
  suggestSlotEndTime,
  summarizeAvailability,
  validateSlotDraft,
  validateWorkingHourDraft,
  workingHourToDraft,
} from "../availabilityLogic";
import { useProviderAvailability } from "../useProviderAvailability";
import type {
  AvailabilityFeedback as AvailabilityFeedbackData,
  SlotDialogSessionState,
  SlotFieldKey,
  SlotStatusAction,
  SlotUncertainAction,
  WorkingHourFieldKey,
  WorkingHourUncertainAction,
  WorkingHoursDialogSessionState,
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
  const [workingSession, setWorkingSession] =
    useState<WorkingHoursDialogSessionState>(INITIAL_WORKING_HOURS_SESSION);
  const [slotSession, setSlotSession] = useState<SlotDialogSessionState>(
    INITIAL_SLOT_DIALOG_SESSION,
  );
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
  // Keep workingSession, slotSession, and pendingUncertain states in memory on same-identity revalidate error.
  useEffect(() => {
    if (!sessionBoundary.resetPrivateState) return;
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = null;
    submittingRef.current = false;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
      setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
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
    workingSession.dialog !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    workingSession.dialog.identity === sessionBoundary.identity
      ? workingSession.dialog
      : null;

  const activePendingWorkingUncertain =
    workingSession.pendingUncertain !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    workingSession.pendingUncertain.identity === sessionBoundary.identity
      ? workingSession.pendingUncertain
      : null;

  const activeSlotEditor =
    slotSession.editor !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    slotSession.editor.identity === sessionBoundary.identity
      ? slotSession.editor
      : null;

  const activePendingSlotUncertain =
    slotSession.pendingUncertain !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    slotSession.pendingUncertain.identity === sessionBoundary.identity
      ? slotSession.pendingUncertain
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
  // while retaining drafts and pendingUncertain state in memory for the same identity.
  const canRenderDialogs =
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    profileReady;

  const showWorkingDialog =
    canRenderDialogs &&
    workingSession.dialogOpen &&
    activeWorkingDialog !== null;
  const showSlotDialog =
    canRenderDialogs &&
    slotSession.dialogOpen &&
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
    const targetIdentity = sessionBoundary.identity;
    setScopedFeedback(null);
    setSlotSession((current) => closeSlotDialogSession(current));
    setSlotsDialogIdentity(null);
    setWorkingSession((current) =>
      openWorkingHoursDialogSession(current, targetIdentity),
    );
  }

  function reopenPendingWorkingHours() {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const targetIdentity = sessionBoundary.identity;
    setSlotSession((current) => closeSlotDialogSession(current));
    setSlotsDialogIdentity(null);
    setWorkingSession((current) =>
      reopenPendingWorkingHoursSession(current, targetIdentity),
    );
  }

  function closeWorkingHoursDialog() {
    if (submittingRef.current) return;
    setWorkingSession((current) => closeWorkingHoursDialogSession(current));
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
    setWorkingSession((current) => closeWorkingHoursDialogSession(current));
    setSlotSession((current) => closeSlotDialogSession(current));
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
    const targetIdentity = sessionBoundary.identity;
    const freshNow = new Date().toISOString();
    setNowIso(freshNow);
    setScopedFeedback(null);
    setWorkingSession((current) => closeWorkingHoursDialogSession(current));
    setSlotsDialogIdentity(null);
    const firstActive = availabilityState.services.find(
      (item) => item.status === "ACTIVE",
    );
    setSlotSession((current) =>
      openCreateSlotDialogSession(
        current,
        targetIdentity,
        localDate(freshNow),
        firstActive?.id ?? "",
      ),
    );
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
    const targetIdentity = sessionBoundary.identity;
    setNowIso(new Date().toISOString());
    setScopedFeedback(null);
    setWorkingSession((current) => closeWorkingHoursDialogSession(current));
    setSlotsDialogIdentity(null);
    setSlotSession((current) =>
      openEditSlotDialogSession(current, targetIdentity, target),
    );
  }

  function reopenPendingSlot() {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const targetIdentity = sessionBoundary.identity;
    setWorkingSession((current) => closeWorkingHoursDialogSession(current));
    setSlotsDialogIdentity(null);
    setSlotSession((current) =>
      reopenPendingSlotSession(current, targetIdentity),
    );
  }

  function closeSlotEditor() {
    if (submittingRef.current) return;
    setSlotSession((current) => closeSlotDialogSession(current));
  }

  function handleChangeWorkingHourField(
    field: WorkingHourFieldKey,
    value: string | DayOfWeek,
  ) {
    setWorkingSession((current) => {
      const dialog = current.dialog;
      if (
        !dialog ||
        dialog.saving ||
        dialog.mutatingRowId !== null ||
        dialog.reconciling ||
        dialog.uncertain !== null ||
        current.pendingUncertain !== null ||
        !canManageResources
      ) {
        return current;
      }
      const nextErrors = { ...dialog.errors };
      delete nextErrors[field];
      delete nextErrors.form;
      return {
        ...current,
        dialog: {
          ...dialog,
          draft: { ...dialog.draft, [field]: value },
          errors: nextErrors,
          error: null,
          reconcileNote: null,
          inlineFeedback: null,
        },
      };
    });
  }

  function handleStartEditWorkingHour(hour: ProviderWorkingHour) {
    if (submittingRef.current || !canManageResources) return;
    setWorkingSession((current) =>
      current.dialog &&
      current.dialog.uncertain === null &&
      current.pendingUncertain === null
        ? {
            ...current,
            dialog: {
              ...current.dialog,
              mode: "edit",
              editingId: hour.id,
              draft: workingHourToDraft(hour),
              errors: {},
              confirmDeactivateId: null,
              error: null,
              reconcileNote: null,
              inlineFeedback: null,
            },
          }
        : current,
    );
  }

  function handleCancelEditWorkingHour() {
    if (submittingRef.current) return;
    setWorkingSession((current) =>
      current.dialog
        ? {
            ...current,
            dialog: {
              ...current.dialog,
              mode: "create",
              editingId: null,
              draft: workingHourToDraft(null, current.dialog.draft.dayOfWeek),
              errors: {},
              error: null,
              reconcileNote: null,
            },
          }
        : current,
    );
  }

  function handleChangeSlotField(field: SlotFieldKey, value: string) {
    setSlotSession((current) => {
      const editor = current.editor;
      if (
        !editor ||
        editor.saving ||
        editor.updatingStatus ||
        editor.reconciling ||
        editor.uncertain !== null ||
        current.pendingUncertain !== null ||
        !canManageResources
      ) {
        return current;
      }

      const nextDraft = { ...editor.draft, [field]: value };
      let nextAutoEndTime = editor.autoEndTime;
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

      const nextErrors = { ...editor.errors };
      delete nextErrors[field];
      if (field === "serviceId" || field === "startTime") {
        delete nextErrors.endTime;
      }
      delete nextErrors.form;

      return {
        ...current,
        editor: {
          ...editor,
          draft: nextDraft,
          autoEndTime: nextAutoEndTime,
          errors: nextErrors,
          saveError: null,
          reconcileNote: null,
        },
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
      activePendingWorkingUncertain !== null ||
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
      setWorkingSession((current) =>
        current.dialog
          ? {
              ...current,
              dialog: { ...current.dialog, errors: validationErrors },
            }
          : current,
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
    const attemptMode = activeWorkingDialog.mode;
    const attemptEditingId = activeWorkingDialog.editingId;
    const attemptDraft = activeWorkingDialog.draft;
    const preSubmitIds = availabilityState.workingHours.map((item) => item.id);
    const operation =
      plan.kind === "create" ? "create-working-hour" : "update-working-hour";
    const uncertainSpec: WorkingHourUncertainAction =
      plan.kind === "create"
        ? {
            kind: "create",
            preSubmitIds,
            expected: plan.expected,
          }
        : {
            kind: plan.kind === "reactivate" ? "reactivate" : "update",
            workingHourId: plan.workingHourId,
            expected: plan.expected,
          };
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setWorkingSession((current) =>
      current.dialog && current.dialog.identity === attemptIdentity
        ? {
            ...current,
            dialog: {
              ...current.dialog,
              errors: {},
              saving: true,
              confirmDeactivateId: null,
              error: null,
              reconcileNote: null,
              inlineFeedback: null,
            },
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      let saved: ProviderWorkingHour;
      let successMessage: string;
      const dayLabel = getDayOfWeekLabel(attemptDraft.dayOfWeek);

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

      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }
      if (controller.signal.aborted) {
        setWorkingSession((current) =>
          recoverAbortedWorkingHoursMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: classifyProviderError(new ApiError("network"), operation),
          }),
        );
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

      setWorkingSession((current) =>
        current.dialog && current.dialog.identity === attemptIdentity
          ? {
              ...current,
              pendingUncertain: null,
              dialog: {
                ...current.dialog,
                mode: "create",
                editingId: null,
                draft: workingHourToDraft(null, saved.dayOfWeek),
                errors: {},
                saving: false,
                error: null,
                inlineFeedback: { outcome: "success", message: finalMessage },
              },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setWorkingSession((current) =>
          recoverAbortedWorkingHoursMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: classifyProviderError(new ApiError("network"), operation),
          }),
        );
        return;
      }
      if (
        providerSessionIdentityKey(snapshot()) !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, operation);

      if (info.outcome === "session-ended") {
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      if (info.code === "WORKING_HOUR_NOT_FOUND") {
        setWorkingSession((current) =>
          current.dialog && current.dialog.identity === attemptIdentity
            ? {
                ...current,
                dialog: {
                  ...current.dialog,
                  mode: "create",
                  editingId: null,
                  saving: false,
                  error: info,
                },
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
        setWorkingSession((current) =>
          current.dialog && current.dialog.identity === attemptIdentity
            ? {
                ...current,
                dialog: { ...current.dialog, saving: false, error: info },
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
        setWorkingSession((current) =>
          enterWorkingHoursUncertainSession(current, {
            attemptIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setWorkingSession((current) =>
        current.dialog && current.dialog.identity === attemptIdentity
          ? {
              ...current,
              dialog: { ...current.dialog, saving: false, error: info },
            }
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
      activePendingWorkingUncertain !== null ||
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
    const attemptMode = activeWorkingDialog.mode;
    const attemptEditingId = activeWorkingDialog.editingId;
    const attemptDraft = activeWorkingDialog.draft;
    const uncertainSpec: WorkingHourUncertainAction = {
      kind: "deactivate",
      workingHourId,
    };
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setWorkingSession((current) =>
      current.dialog && current.dialog.identity === attemptIdentity
        ? {
            ...current,
            dialog: {
              ...current.dialog,
              mutatingRowId: workingHourId,
              error: null,
              reconcileNote: null,
              inlineFeedback: null,
            },
          }
        : current,
    );

    const feedbackLocale = vi.provider.availability.feedback;

    try {
      await deactivateWorkingHour(workingHourId, {
        signal: controller.signal,
      });

      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }
      if (controller.signal.aborted) {
        setWorkingSession((current) =>
          recoverAbortedWorkingHoursMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: classifyProviderError(
              new ApiError("network"),
              "deactivate-working-hour",
            ),
          }),
        );
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

      setWorkingSession((current) =>
        current.dialog && current.dialog.identity === attemptIdentity
          ? {
              ...current,
              pendingUncertain: null,
              dialog: {
                ...current.dialog,
                mode:
                  current.dialog.editingId === workingHourId
                    ? "create"
                    : current.dialog.mode,
                editingId:
                  current.dialog.editingId === workingHourId
                    ? null
                    : current.dialog.editingId,
                mutatingRowId: null,
                confirmDeactivateId: null,
                error: null,
                inlineFeedback: { outcome: "success", message: finalMessage },
              },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setWorkingSession((current) =>
          recoverAbortedWorkingHoursMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: classifyProviderError(
              new ApiError("network"),
              "deactivate-working-hour",
            ),
          }),
        );
        return;
      }
      if (
        providerSessionIdentityKey(snapshot()) !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, "deactivate-working-hour");
      if (info.outcome === "session-ended") {
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      if (info.code === "WORKING_HOUR_NOT_FOUND") {
        setWorkingSession((current) =>
          current.dialog && current.dialog.identity === attemptIdentity
            ? {
                ...current,
                dialog: {
                  ...current.dialog,
                  mutatingRowId: null,
                  confirmDeactivateId: null,
                  error: info,
                },
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
        setWorkingSession((current) =>
          current.dialog && current.dialog.identity === attemptIdentity
            ? {
                ...current,
                dialog: {
                  ...current.dialog,
                  mutatingRowId: null,
                  confirmDeactivateId: null,
                  error: info,
                },
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
        setWorkingSession((current) =>
          enterWorkingHoursUncertainSession(current, {
            attemptIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setWorkingSession((current) =>
        current.dialog && current.dialog.identity === attemptIdentity
          ? {
              ...current,
              dialog: { ...current.dialog, mutatingRowId: null, error: info },
            }
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
      activePendingWorkingUncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeWorkingDialog.identity;
    const attemptMode = activeWorkingDialog.mode;
    const attemptEditingId = activeWorkingDialog.editingId;
    const attemptDraft = activeWorkingDialog.draft;
    const uncertainSpec: WorkingHourUncertainAction = {
      kind: "reactivate",
      workingHourId: hour.id,
      expected: { isActive: true },
    };
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setWorkingSession((current) =>
      current.dialog && current.dialog.identity === attemptIdentity
        ? {
            ...current,
            dialog: {
              ...current.dialog,
              mutatingRowId: hour.id,
              confirmDeactivateId: null,
              error: null,
              reconcileNote: null,
              inlineFeedback: null,
            },
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

      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }
      if (controller.signal.aborted) {
        setWorkingSession((current) =>
          recoverAbortedWorkingHoursMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: classifyProviderError(
              new ApiError("network"),
              "update-working-hour",
            ),
          }),
        );
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

      setWorkingSession((current) =>
        current.dialog && current.dialog.identity === attemptIdentity
          ? {
              ...current,
              pendingUncertain: null,
              dialog: {
                ...current.dialog,
                mutatingRowId: null,
                error: null,
                inlineFeedback: { outcome: "success", message: finalMessage },
              },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setWorkingSession((current) =>
          recoverAbortedWorkingHoursMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: classifyProviderError(
              new ApiError("network"),
              "update-working-hour",
            ),
          }),
        );
        return;
      }
      if (
        providerSessionIdentityKey(snapshot()) !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, "update-working-hour");
      if (info.outcome === "session-ended") {
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setWorkingSession((current) =>
          current.dialog && current.dialog.identity === attemptIdentity
            ? {
                ...current,
                dialog: { ...current.dialog, mutatingRowId: null, error: info },
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
        setWorkingSession((current) =>
          enterWorkingHoursUncertainSession(current, {
            attemptIdentity,
            mode: attemptMode,
            editingId: attemptEditingId,
            draft: attemptDraft,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setWorkingSession((current) =>
        current.dialog && current.dialog.identity === attemptIdentity
          ? {
              ...current,
              dialog: { ...current.dialog, mutatingRowId: null, error: info },
            }
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
    const pending = activePendingWorkingUncertain;
    const uncertain =
      pending?.uncertain ?? activeWorkingDialog?.uncertain ?? null;
    const attemptIdentity =
      pending?.identity ?? activeWorkingDialog?.identity ?? null;
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !uncertain ||
      !attemptIdentity ||
      cooldownSeconds > 0
    ) {
      return;
    }

    submittingRef.current = true;

    setWorkingSession((current) => {
      const base =
        current.dialog && current.dialog.identity === attemptIdentity
          ? current.dialog
          : current.pendingUncertain &&
              current.pendingUncertain.identity === attemptIdentity
            ? buildWorkingHoursDialogFromPending(current.pendingUncertain)
            : null;
      if (!base) return current;
      return {
        ...current,
        dialog: { ...base, reconciling: true, error: null, reconcileNote: null },
      };
    });

    const weeklyLocale = vi.provider.availability.weekly;
    const feedbackLocale = vi.provider.availability.feedback;

    try {
      const [hoursRes, profileRes] = await Promise.all([
        availabilityState.reloadWorkingHours(),
        profileState.reload(),
      ]);
      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

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
        setWorkingSession(INITIAL_WORKING_HOURS_SESSION);
        return;
      }

      if (!hoursRes.ok) {
        if (hoursRes.aborted) {
          setWorkingSession((current) =>
            recoverAbortedWorkingHoursReconcile(
              current,
              attemptIdentity,
              liveIdentity,
            ),
          );
          return;
        }
        startCooldown(hoursRes.error.retryAfterSeconds);
        setWorkingSession((current) => ({
          ...current,
          pendingUncertain:
            current.pendingUncertain &&
            current.pendingUncertain.identity === attemptIdentity
              ? { ...current.pendingUncertain, error: hoursRes.error }
              : current.pendingUncertain,
          dialog:
            current.dialog && current.dialog.identity === attemptIdentity
              ? { ...current.dialog, reconciling: false, error: hoursRes.error }
              : current.dialog,
        }));
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
          setWorkingSession((current) => {
            if (!current.dialogOpen) return INITIAL_WORKING_HOURS_SESSION;
            const base =
              current.dialog && current.dialog.identity === attemptIdentity
                ? current.dialog
                : null;
            if (!base) return INITIAL_WORKING_HOURS_SESSION;
            return {
              dialogOpen: true,
              pendingUncertain: null,
              dialog: {
                ...base,
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
              },
            };
          });
          setPageFeedback(
            attemptIdentity,
            "success",
            feedbackLocale.workingHourReconciledCreated,
          );
          return;
        }
        if (res.outcome === "forbidden-lifecycle") {
          const info = lifecycleErrorInfo(res.approvalStatus);
          setWorkingSession((current) =>
            keepWorkingHoursUncertainOnLifecycleLock(
              current,
              attemptIdentity,
              info,
              getProviderErrorMessage(info),
            ),
          );
          return;
        }
        setWorkingSession((current) => {
          const base =
            current.dialog && current.dialog.identity === attemptIdentity
              ? current.dialog
              : current.pendingUncertain &&
                  current.pendingUncertain.identity === attemptIdentity
                ? buildWorkingHoursDialogFromPending(current.pendingUncertain)
                : null;
          if (!base) return INITIAL_WORKING_HOURS_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            dialog: {
              ...base,
              reconciling: false,
              uncertain: null,
              error: null,
              reconcileNote: weeklyLocale.reconcileNotCreated,
            },
          };
        });
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
        setWorkingSession((current) => {
          if (!current.dialogOpen) return INITIAL_WORKING_HOURS_SESSION;
          const base =
            current.dialog && current.dialog.identity === attemptIdentity
              ? current.dialog
              : null;
          if (!base) return INITIAL_WORKING_HOURS_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            dialog: {
              ...base,
              mode: "create",
              editingId: null,
              reconciling: false,
              uncertain: null,
              error: null,
              inlineFeedback: { outcome: "success", message },
            },
          };
        });
        setPageFeedback(attemptIdentity, "success", message);
        return;
      }
      if (res.outcome === "not-found") {
        const message = getProviderErrorMessageByCode("WORKING_HOUR_NOT_FOUND");
        setWorkingSession((current) => {
          if (!current.dialogOpen) return INITIAL_WORKING_HOURS_SESSION;
          const base =
            current.dialog && current.dialog.identity === attemptIdentity
              ? current.dialog
              : null;
          if (!base) return INITIAL_WORKING_HOURS_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            dialog: {
              ...base,
              mode: "create",
              editingId: null,
              reconciling: false,
              uncertain: null,
              inlineFeedback: { outcome: "error", message },
            },
          };
        });
        setPageFeedback(attemptIdentity, "error", message);
        return;
      }
      if (res.outcome === "forbidden-lifecycle") {
        const info = lifecycleErrorInfo(res.approvalStatus);
        setWorkingSession((current) =>
          keepWorkingHoursUncertainOnLifecycleLock(
            current,
            attemptIdentity,
            info,
            getProviderErrorMessage(info),
          ),
        );
        return;
      }
      setWorkingSession((current) => {
        const base =
          current.dialog && current.dialog.identity === attemptIdentity
            ? current.dialog
            : current.pendingUncertain &&
                current.pendingUncertain.identity === attemptIdentity
              ? buildWorkingHoursDialogFromPending(current.pendingUncertain)
              : null;
        if (!base) return INITIAL_WORKING_HOURS_SESSION;
        return {
          dialogOpen: true,
          pendingUncertain: null,
          dialog: {
            ...base,
            reconciling: false,
            uncertain: null,
            error: null,
            reconcileNote:
              uncertain.kind === "deactivate"
                ? weeklyLocale.reconcileNotDeactivated
                : weeklyLocale.reconcileNotSaved,
          },
        };
      });
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
      activePendingSlotUncertain !== null ||
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
      setSlotSession((current) =>
        current.editor
          ? {
              ...current,
              editor: { ...current.editor, errors: validationErrors },
            }
          : current,
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
    const attemptMode = activeSlotEditor.mode;
    const attemptSlotId = activeSlotEditor.slotId;
    const attemptDraft = activeSlotEditor.draft;
    const attemptAutoEndTime = activeSlotEditor.autoEndTime;
    const attemptConfirmAction = activeSlotEditor.confirmAction;
    const preSubmitIds = availabilityState.slots.map((item) => item.id);
    const operation = isEdit ? "update-availability" : "create-availability";
    const uncertainSpec: SlotUncertainAction =
      isEdit && editingSlot && updatePatch
        ? {
            kind: "update",
            slotId: editingSlot.id,
            expected: updatePatch.expected,
          }
        : {
            kind: "create",
            preSubmitIds,
            expected: createPayload!.expected,
          };
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setSlotSession((current) =>
      current.editor && current.editor.identity === attemptIdentity
        ? {
            ...current,
            editor: {
              ...current.editor,
              errors: {},
              saving: true,
              confirmAction: null,
              saveError: null,
              statusError: null,
              reconcileNote: null,
              statusFeedback: null,
            },
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
        const liveIdentity = providerSessionIdentityKey(snapshot());
        if (
          liveIdentity !== attemptIdentity ||
          currentIdentityRef.current !== attemptIdentity
        ) {
          return;
        }
        if (controller.signal.aborted) {
          setSlotSession((current) =>
            recoverAbortedSlotMutation(current, {
              attemptIdentity,
              liveIdentity,
              mode: attemptMode,
              slotId: attemptSlotId,
              draft: attemptDraft,
              autoEndTime: attemptAutoEndTime,
              confirmAction: attemptConfirmAction,
              uncertain: uncertainSpec,
              error: classifyProviderError(new ApiError("network"), operation),
            }),
          );
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
          setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            `${feedbackLocale.slotUpdated} ${feedbackLocale.refreshWarning}`,
          );
          return;
        }
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        setPageFeedback(attemptIdentity, "success", feedbackLocale.slotUpdated);
      } else if (createPayload) {
        const created = await createAvailabilitySlot(createPayload.input, {
          signal: controller.signal,
        });
        const liveIdentity = providerSessionIdentityKey(snapshot());
        if (
          liveIdentity !== attemptIdentity ||
          currentIdentityRef.current !== attemptIdentity
        ) {
          return;
        }
        if (controller.signal.aborted) {
          setSlotSession((current) =>
            recoverAbortedSlotMutation(current, {
              attemptIdentity,
              liveIdentity,
              mode: attemptMode,
              slotId: attemptSlotId,
              draft: attemptDraft,
              autoEndTime: attemptAutoEndTime,
              confirmAction: attemptConfirmAction,
              uncertain: uncertainSpec,
              error: classifyProviderError(new ApiError("network"), operation),
            }),
          );
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
          setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            `${createdMessage} ${feedbackLocale.refreshWarning}`,
          );
          return;
        }
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        setPageFeedback(attemptIdentity, "success", createdMessage);
      }
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setSlotSession((current) =>
          recoverAbortedSlotMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            slotId: attemptSlotId,
            draft: attemptDraft,
            autoEndTime: attemptAutoEndTime,
            confirmAction: attemptConfirmAction,
            uncertain: uncertainSpec,
            error: classifyProviderError(new ApiError("network"), operation),
          }),
        );
        return;
      }
      if (
        providerSessionIdentityKey(snapshot()) !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, operation);

      if (info.outcome === "session-ended") {
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        return;
      }

      if (info.code === "SLOT_NOT_FOUND") {
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
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
        setSlotSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: { ...current.editor, saving: false, saveError: info },
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

      if (info.code === "SERVICE_INACTIVE" || info.code === "SERVICE_NOT_FOUND") {
        setSlotSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: {
                  ...current.editor,
                  saving: false,
                  saveError: info,
                  errors: {
                    ...current.editor.errors,
                    serviceId: getProviderErrorMessage(info),
                  },
                },
              }
            : current,
        );
        void availabilityState.reloadServices();
        return;
      }

      if (info.code === "SLOT_OUTSIDE_WORKING_HOURS") {
        setSlotSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: { ...current.editor, saving: false, saveError: info },
              }
            : current,
        );
        void availabilityState.reloadWorkingHours();
        return;
      }

      if (
        info.code === "SLOT_HAS_BOOKINGS_LOCKED_FIELDS" ||
        info.code === "SLOT_CAPACITY_BELOW_BOOKED"
      ) {
        setSlotSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: { ...current.editor, saving: false, saveError: info },
              }
            : current,
        );
        void availabilityState.reloadSlots();
        return;
      }

      if (info.outcome === "unknown") {
        setSlotSession((current) =>
          enterSlotUncertainSession(current, {
            attemptIdentity,
            mode: attemptMode,
            slotId: attemptSlotId,
            draft: attemptDraft,
            autoEndTime: attemptAutoEndTime,
            confirmAction: attemptConfirmAction,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setSlotSession((current) =>
        current.editor && current.editor.identity === attemptIdentity
          ? {
              ...current,
              editor: { ...current.editor, saving: false, saveError: info },
            }
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
    setSlotSession((current) => {
      const editor = current.editor;
      if (
        !editor ||
        editor.mode !== "edit" ||
        editor.saving ||
        editor.updatingStatus ||
        editor.reconciling ||
        editor.uncertain !== null ||
        current.pendingUncertain !== null
      ) {
        return current;
      }
      return {
        ...current,
        editor: {
          ...editor,
          confirmAction: action,
          statusError: null,
          statusFeedback: null,
          reconcileNote: null,
        },
      };
    });
  }

  function handleCancelSlotStatusAction() {
    if (submittingRef.current) return;
    setSlotSession((current) =>
      current.editor
        ? {
            ...current,
            editor: {
              ...current.editor,
              confirmAction: null,
              statusError: null,
            },
          }
        : current,
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
      activePendingSlotUncertain !== null ||
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
      setSlotSession((current) =>
        current.editor
          ? {
              ...current,
              editor: {
                ...current.editor,
                confirmAction: null,
                reconcileNote: reopenCheck.reason,
              },
            }
          : current,
      );
      return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeSlotEditor.identity;
    const attemptDraft = activeSlotEditor.draft;
    const attemptAutoEndTime = activeSlotEditor.autoEndTime;
    const operation =
      action === "cancel" ? "deactivate-availability" : "update-availability";
    const uncertainSpec: SlotUncertainAction =
      action === "cancel"
        ? { kind: "cancel", slotId }
        : {
            kind: "status",
            slotId,
            targetStatus: action === "close" ? "CLOSED" : "OPEN",
          };
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setSlotSession((current) =>
      current.editor && current.editor.identity === attemptIdentity
        ? {
            ...current,
            editor: {
              ...current.editor,
              updatingStatus: true,
              saveError: null,
              statusError: null,
              reconcileNote: null,
              statusFeedback: null,
            },
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

      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }
      if (controller.signal.aborted) {
        setSlotSession((current) =>
          recoverAbortedSlotMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: "edit",
            slotId,
            draft: attemptDraft,
            autoEndTime: attemptAutoEndTime,
            confirmAction: action,
            uncertain: uncertainSpec,
            error: classifyProviderError(new ApiError("network"), operation),
          }),
        );
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

      setSlotSession((current) =>
        current.editor && current.editor.identity === attemptIdentity
          ? {
              ...current,
              pendingUncertain: null,
              editor: {
                ...current.editor,
                updatingStatus: false,
                confirmAction: null,
                statusError: null,
                statusFeedback: finalMessage,
              },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", finalMessage);
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setSlotSession((current) =>
          recoverAbortedSlotMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: "edit",
            slotId,
            draft: attemptDraft,
            autoEndTime: attemptAutoEndTime,
            confirmAction: action,
            uncertain: uncertainSpec,
            error: classifyProviderError(new ApiError("network"), operation),
          }),
        );
        return;
      }
      if (
        providerSessionIdentityKey(snapshot()) !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, operation);

      if (info.outcome === "session-ended") {
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        return;
      }

      if (info.code === "SLOT_NOT_FOUND") {
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
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
        setSlotSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: {
                  ...current.editor,
                  updatingStatus: false,
                  confirmAction: null,
                  statusError: info,
                },
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
        setSlotSession((current) =>
          enterSlotUncertainSession(current, {
            attemptIdentity,
            mode: "edit",
            slotId,
            draft: attemptDraft,
            autoEndTime: attemptAutoEndTime,
            confirmAction: action,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setSlotSession((current) =>
        current.editor && current.editor.identity === attemptIdentity
          ? {
              ...current,
              editor: { ...current.editor, updatingStatus: false, statusError: info },
            }
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
    const pending = activePendingSlotUncertain;
    const uncertain =
      pending?.uncertain ?? activeSlotEditor?.uncertain ?? null;
    const attemptIdentity =
      pending?.identity ?? activeSlotEditor?.identity ?? null;
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !uncertain ||
      !attemptIdentity ||
      cooldownSeconds > 0
    ) {
      return;
    }

    submittingRef.current = true;

    setSlotSession((current) => {
      const base =
        current.editor && current.editor.identity === attemptIdentity
          ? current.editor
          : current.pendingUncertain &&
              current.pendingUncertain.identity === attemptIdentity
            ? buildSlotEditorFromPending(current.pendingUncertain)
            : null;
      if (!base) return current;
      return {
        ...current,
        editor: {
          ...base,
          reconciling: true,
          saveError: null,
          statusError: null,
          reconcileNote: null,
        },
      };
    });

    const slotLocale = vi.provider.availability.slot;
    const feedbackLocale = vi.provider.availability.feedback;

    try {
      const [slotsRes, profileRes] = await Promise.all([
        availabilityState.reloadSlots(),
        profileState.reload(),
      ]);
      const liveIdentity = providerSessionIdentityKey(snapshot());
      if (
        liveIdentity !== attemptIdentity ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

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
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        return;
      }

      if (!slotsRes.ok) {
        if (slotsRes.aborted) {
          setSlotSession((current) =>
            recoverAbortedSlotReconcile(current, attemptIdentity, liveIdentity),
          );
          return;
        }
        startCooldown(slotsRes.error.retryAfterSeconds);
        const isStatusKind =
          uncertain.kind === "status" || uncertain.kind === "cancel";
        setSlotSession((current) => ({
          ...current,
          pendingUncertain:
            current.pendingUncertain &&
            current.pendingUncertain.identity === attemptIdentity
              ? { ...current.pendingUncertain, error: slotsRes.error }
              : current.pendingUncertain,
          editor:
            current.editor && current.editor.identity === attemptIdentity
              ? {
                  ...current.editor,
                  reconciling: false,
                  saveError: isStatusKind ? null : slotsRes.error,
                  statusError: isStatusKind ? slotsRes.error : null,
                }
              : current.editor,
        }));
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
          setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            feedbackLocale.slotReconciledCreated,
          );
          return;
        }
        if (res.outcome === "forbidden-lifecycle") {
          const info = lifecycleErrorInfo(res.approvalStatus);
          setSlotSession((current) =>
            keepSlotUncertainOnLifecycleLock(
              current,
              attemptIdentity,
              info,
              getProviderErrorMessage(info),
            ),
          );
          return;
        }
        setSlotSession((current) => {
          const base =
            current.editor && current.editor.identity === attemptIdentity
              ? current.editor
              : current.pendingUncertain &&
                  current.pendingUncertain.identity === attemptIdentity
                ? buildSlotEditorFromPending(current.pendingUncertain)
                : null;
          if (!base) return INITIAL_SLOT_DIALOG_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            editor: {
              ...base,
              reconciling: false,
              uncertain: null,
              saveError: null,
              reconcileNote: slotLocale.reconcileNotCreated,
            },
          };
        });
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
          setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            feedbackLocale.slotReconciledUpdated,
          );
          return;
        }
        if (res.outcome === "not-found") {
          setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "error",
            getProviderErrorMessageByCode("SLOT_NOT_FOUND"),
          );
          return;
        }
        if (res.outcome === "forbidden-lifecycle") {
          const info = lifecycleErrorInfo(res.approvalStatus);
          setSlotSession((current) =>
            keepSlotUncertainOnLifecycleLock(
              current,
              attemptIdentity,
              info,
              getProviderErrorMessage(info),
            ),
          );
          return;
        }
        setSlotSession((current) => {
          const base =
            current.editor && current.editor.identity === attemptIdentity
              ? current.editor
              : current.pendingUncertain &&
                  current.pendingUncertain.identity === attemptIdentity
                ? buildSlotEditorFromPending(current.pendingUncertain)
                : null;
          if (!base) return INITIAL_SLOT_DIALOG_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            editor: {
              ...base,
              reconciling: false,
              uncertain: null,
              saveError: null,
              reconcileNote: slotLocale.reconcileNotSaved,
            },
          };
        });
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
        setSlotSession((current) => {
          if (!current.dialogOpen) return INITIAL_SLOT_DIALOG_SESSION;
          const base =
            current.editor && current.editor.identity === attemptIdentity
              ? current.editor
              : null;
          if (!base) return INITIAL_SLOT_DIALOG_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            editor: {
              ...base,
              reconciling: false,
              uncertain: null,
              confirmAction: null,
              statusError: null,
              statusFeedback: message,
            },
          };
        });
        setPageFeedback(attemptIdentity, "success", message);
        return;
      }
      if (res.outcome === "not-found") {
        setSlotSession(INITIAL_SLOT_DIALOG_SESSION);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessageByCode("SLOT_NOT_FOUND"),
        );
        return;
      }
      if (res.outcome === "forbidden-lifecycle") {
        const info = lifecycleErrorInfo(res.approvalStatus);
        setSlotSession((current) =>
          keepSlotUncertainOnLifecycleLock(
            current,
            attemptIdentity,
            info,
            getProviderErrorMessage(info),
          ),
        );
        return;
      }
      setSlotSession((current) => {
        const base =
          current.editor && current.editor.identity === attemptIdentity
            ? current.editor
            : current.pendingUncertain &&
                current.pendingUncertain.identity === attemptIdentity
              ? buildSlotEditorFromPending(current.pendingUncertain)
              : null;
        if (!base) return INITIAL_SLOT_DIALOG_SESSION;
        return {
          dialogOpen: true,
          pendingUncertain: null,
          editor: {
            ...base,
            reconciling: false,
            uncertain: null,
            statusError: null,
            reconcileNote: slotLocale.reconcileStatusNotSaved,
          },
        };
      });
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

              {!showWorkingDialog && activePendingWorkingUncertain && (
                <section className={styles.reconcileBox} role="alert">
                  <div className={styles.reconcileHeading}>
                    <AlertTriangle aria-hidden="true" focusable="false" size={16} />
                    <strong>{vi.provider.availability.weekly.pendingBannerTitle}</strong>
                  </div>
                  <p>
                    {activePendingWorkingUncertain.uncertain.kind === "create"
                      ? vi.provider.availability.weekly.reconcileCreateBody
                      : activePendingWorkingUncertain.uncertain.kind ===
                          "deactivate"
                        ? vi.provider.availability.weekly.reconcileDeactivateBody
                        : vi.provider.availability.weekly.reconcileUpdateBody}
                  </p>
                  {activePendingWorkingUncertain.error && (
                    <p>
                      {getProviderErrorMessage(
                        activePendingWorkingUncertain.error,
                        cooldownSeconds,
                      )}
                    </p>
                  )}
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={
                        busy || sessionBoundary.lockActions || cooldownSeconds > 0
                      }
                      onClick={() => void handleReconcileWorkingHour()}
                    >
                      <RefreshCw aria-hidden="true" focusable="false" size={14} />
                      {activeWorkingDialog?.reconciling
                        ? vi.provider.availability.weekly.reconciling
                        : vi.provider.availability.weekly.reconcileAction}
                    </button>
                    <button
                      type="button"
                      className={styles.outlineButton}
                      disabled={busy || sessionBoundary.lockActions}
                      onClick={reopenPendingWorkingHours}
                    >
                      {vi.provider.availability.weekly.reviewRequest}
                    </button>
                  </div>
                </section>
              )}

              {!showSlotDialog && activePendingSlotUncertain && (
                <section className={styles.reconcileBox} role="alert">
                  <div className={styles.reconcileHeading}>
                    <AlertTriangle aria-hidden="true" focusable="false" size={16} />
                    <strong>{vi.provider.availability.slot.pendingBannerTitle}</strong>
                  </div>
                  <p>
                    {activePendingSlotUncertain.uncertain.kind === "create"
                      ? vi.provider.availability.slot.reconcileCreateBody
                      : activePendingSlotUncertain.uncertain.kind === "status"
                        ? vi.provider.availability.slot.reconcileStatusBody
                        : activePendingSlotUncertain.uncertain.kind === "cancel"
                          ? vi.provider.availability.slot.reconcileCancelBody
                          : vi.provider.availability.slot.reconcileUpdateBody}
                  </p>
                  {activePendingSlotUncertain.error && (
                    <p>
                      {getProviderErrorMessage(
                        activePendingSlotUncertain.error,
                        cooldownSeconds,
                      )}
                    </p>
                  )}
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={
                        busy || sessionBoundary.lockActions || cooldownSeconds > 0
                      }
                      onClick={() => void handleReconcileSlot()}
                    >
                      <RefreshCw aria-hidden="true" focusable="false" size={14} />
                      {activeSlotEditor?.reconciling
                        ? vi.provider.availability.slot.reconciling
                        : vi.provider.availability.slot.reconcileAction}
                    </button>
                    <button
                      type="button"
                      className={styles.outlineButton}
                      disabled={busy || sessionBoundary.lockActions}
                      onClick={reopenPendingSlot}
                    >
                      {vi.provider.availability.slot.reviewRequest}
                    </button>
                  </div>
                </section>
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
            setWorkingSession((current) =>
              current.dialog &&
              current.dialog.uncertain === null &&
              current.pendingUncertain === null
                ? {
                    ...current,
                    dialog: {
                      ...current.dialog,
                      confirmDeactivateId: workingHourId,
                      error: null,
                      reconcileNote: null,
                    },
                  }
                : current,
            )
          }
          onCancelDeactivate={() =>
            setWorkingSession((current) =>
              current.dialog
                ? {
                    ...current,
                    dialog: { ...current.dialog, confirmDeactivateId: null },
                  }
                : current,
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
