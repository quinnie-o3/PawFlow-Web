"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ApiError, isRequestCancelled } from "@/lib/api/errors";
import { formatMessage, vi } from "@/lib/locale";
import { snapshot } from "@/features/session/client";
import {
  classifyProviderError,
  createService,
  deactivateService,
  updateService,
  type ProviderApiErrorInfo,
  type ProviderService,
  type ProviderServiceStatus,
} from "@/features/provider-workspace/liveApi";
import {
  getProviderErrorMessage,
  getProviderErrorMessageByCode,
  providerSessionIdentityKey,
} from "@/features/provider-workspace/lifecycle";
import { useProviderProfile } from "@/features/provider-workspace/useProviderProfile";
import ProviderLifecycleBanner from "@/features/provider-workspace/components/ProviderLifecycleBanner";
import {
  INITIAL_SERVICE_DIALOG_SESSION,
  applyLocalServiceMutation,
  buildCategoryFilterOptions,
  buildCreateServicePayload,
  buildServiceEditorFromPending,
  buildUpdateServicePatch,
  closeServiceDialogSession,
  enterServiceUncertainSession,
  filterServices,
  hasServiceDraftChanges,
  isServiceCategoryInactive,
  keepServiceCreateStillUnknown,
  keepServiceUncertainOnLifecycleLock,
  openCreateServiceDialogSession,
  openEditServiceDialogSession,
  reconcileServiceCreate,
  reconcileServiceUpdate,
  recoverAbortedServiceMutation,
  recoverAbortedServiceReconcile,
  reopenPendingServiceUncertainSession,
  validateServiceDraft,
} from "../serviceLogic";
import { useProviderServices } from "../useProviderServices";
import type {
  ServiceDialogSessionState,
  ServiceFeedback,
  ServiceFieldKey,
  ServiceFilters,
  ServiceUncertainState,
} from "../types";
import ServiceDialog from "./ServiceDialog";
import ServicesFeedback from "./ServicesFeedback";
import ServicesGuidance from "./ServicesGuidance";
import ServicesList from "./ServicesList";
import ServicesSummary from "./ServicesSummary";
import ServicesToolbar from "./ServicesToolbar";
import styles from "../services.module.css";

type ScopedFeedback = Readonly<{
  identity: string;
  feedback: ServiceFeedback;
}>;

const INITIAL_FILTERS: ServiceFilters = {
  query: "",
  status: "ALL",
  categoryId: "",
};

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

export default function ProviderServicesPage() {
  const profileState = useProviderProfile();
  const { sessionBoundary, status: profileStatus, profile, permissions } =
    profileState;

  const servicesState = useProviderServices({
    identity: sessionBoundary.identity,
    canFetchPrivate: sessionBoundary.canFetchPrivate,
    hidePrivateData: sessionBoundary.hidePrivateData,
    resetPrivateState: sessionBoundary.resetPrivateState,
    profileReady: profileStatus === "ready" && profile !== null,
    onProfileNotFound: profileState.markNotFound,
  });

  const [filters, setFilters] = useState<ServiceFilters>(INITIAL_FILTERS);
  const [rawQuery, setRawQuery] = useState("");
  const [dialogSession, setDialogSession] =
    useState<ServiceDialogSessionState>(INITIAL_SERVICE_DIALOG_SESSION);
  const [scopedFeedback, setScopedFeedback] = useState<ScopedFeedback | null>(
    null,
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  // Single shared lock across create, update, deactivate/reactivate, and reconcile.
  const submittingRef = useRef(false);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const currentIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdentityRef.current = sessionBoundary.identity;
  }, [sessionBoundary.identity]);

  useEffect(() => {
    return () => {
      mutationControllerRef.current?.abort();
      mutationControllerRef.current = null;
    };
  }, []);

  // Purge all private state asynchronously on 401/logout/identity switch.
  // Preserve editor draft and pendingUncertain in memory on same-identity revalidate error.
  useEffect(() => {
    if (!sessionBoundary.resetPrivateState) return;
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = null;
    submittingRef.current = false;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
      setScopedFeedback(null);
      setFilters(INITIAL_FILTERS);
      setRawQuery("");
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

  const activeEditor =
    dialogSession.editor !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    dialogSession.editor.identity === sessionBoundary.identity
      ? dialogSession.editor
      : null;

  const activePendingUncertain =
    dialogSession.pendingUncertain !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    dialogSession.pendingUncertain.identity === sessionBoundary.identity
      ? dialogSession.pendingUncertain
      : null;

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
  const canCreate =
    profileReady &&
    canManageResources &&
    !sessionBoundary.lockActions &&
    !sessionBoundary.hidePrivateData;

  const editingService: ProviderService | null =
    activeEditor?.mode === "edit" && activeEditor.serviceId
      ? servicesState.services.find(
          (item) => item.id === activeEditor.serviceId,
        ) ?? null
      : null;

  const hasChanges =
    activeEditor?.mode === "edit" && editingService !== null
      ? hasServiceDraftChanges(editingService, activeEditor.draft)
      : true;

  // Unmount <ProviderWorkspaceDialog> whenever private UI is hidden (including same-identity
  // revalidate error) to release native top-layer backdrop while keeping pendingUncertain & draft in memory.
  const showDialog =
    dialogSession.dialogOpen &&
    activeEditor !== null &&
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    profileReady &&
    (activeEditor.mode === "create" || editingService !== null);

  const categoriesLoaded = servicesState.categoriesStatus === "ready";
  const categoryFilterOptions = buildCategoryFilterOptions(
    servicesState.services,
    servicesState.categories,
    categoriesLoaded,
  );
  const filteredServices = filterServices(
    servicesState.services,
    filters,
    servicesState.categories,
  );

  function setPageFeedback(
    identity: string,
    outcome: "success" | "error",
    message: string,
  ) {
    setScopedFeedback({ identity, feedback: { outcome, message } });
  }

  function openCreate() {
    if (
      submittingRef.current ||
      !canCreate ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const targetIdentity = sessionBoundary.identity;
    setScopedFeedback(null);
    setDialogSession((current) =>
      openCreateServiceDialogSession(current, targetIdentity),
    );
  }

  function openEdit(serviceId: string) {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const target = servicesState.services.find((item) => item.id === serviceId);
    if (!target) return;
    const targetIdentity = sessionBoundary.identity;
    setScopedFeedback(null);
    setDialogSession((current) =>
      openEditServiceDialogSession(current, targetIdentity, target),
    );
  }

  function reopenPendingUncertain() {
    if (
      submittingRef.current ||
      !profileReady ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    const targetIdentity = sessionBoundary.identity;
    setDialogSession((current) =>
      reopenPendingServiceUncertainSession(current, targetIdentity),
    );
  }

  function closeEditor() {
    if (submittingRef.current) return;
    setDialogSession((current) => closeServiceDialogSession(current));
  }

  function changeDraftField(field: ServiceFieldKey, value: string) {
    setDialogSession((current) => {
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
      const nextErrors = { ...editor.errors };
      delete nextErrors[field];
      return {
        ...current,
        editor: {
          ...editor,
          draft: { ...editor.draft, [field]: value },
          errors: nextErrors,
          saveError: null,
          reconcileNote: null,
        },
      };
    });
  }

  function requestStatusChange(targetStatus: ProviderServiceStatus) {
    if (
      submittingRef.current ||
      !canManageResources ||
      sessionBoundary.lockActions
    ) {
      return;
    }
    setDialogSession((current) => {
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
          confirmStatus: targetStatus,
          statusError: null,
          statusFeedback: null,
          reconcileNote: null,
        },
      };
    });
  }

  function cancelStatusChange() {
    if (submittingRef.current) return;
    setDialogSession((current) =>
      current.editor
        ? {
            ...current,
            editor: {
              ...current.editor,
              confirmStatus: null,
              statusError: null,
            },
          }
        : current,
    );
  }

  function handleClearFilters() {
    setRawQuery("");
    setFilters(INITIAL_FILTERS);
  }

  async function handleReloadAll() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    const [profileResult, listResult] = await Promise.all([
      profileState.reload(),
      profileReady
        ? servicesState.reloadServices()
        : Promise.resolve({ ok: false as const, aborted: true as const }),
    ]);
    if (!profileResult.ok && !profileResult.aborted) {
      startCooldown(profileResult.error.retryAfterSeconds);
    }
    if (!listResult.ok && !listResult.aborted) {
      startCooldown(listResult.error.retryAfterSeconds);
    }
    if (
      servicesState.categoriesStatus === "error" ||
      (servicesState.categoriesStatus === "ready" &&
        servicesState.categories.length === 0)
    ) {
      void servicesState.reloadCategories();
    }
  }

  async function handleRetryServices() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    const result = await servicesState.reloadServices();
    if (!result.ok && !result.aborted) {
      startCooldown(result.error.retryAfterSeconds);
    }
  }

  async function handleSave() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeEditor ||
      !profile ||
      !canManageResources ||
      activeEditor.uncertain !== null ||
      activePendingUncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const isEdit = activeEditor.mode === "edit";
    if (isEdit && !editingService) return;

    const validationErrors = validateServiceDraft(
      activeEditor.draft,
      servicesState.categories,
      editingService ?? undefined,
    );
    const firstErrorField = (
      ["name", "categoryId", "price", "durationMinutes"] as const
    ).find((key) => Boolean(validationErrors[key]));
    if (firstErrorField) {
      setDialogSession((current) =>
        current.editor
          ? {
              ...current,
              editor: { ...current.editor, errors: validationErrors },
            }
          : current,
      );
      window.requestAnimationFrame(() => {
        document.getElementById(`service-field-${firstErrorField}`)?.focus();
      });
      return;
    }

    let createPayload: ReturnType<typeof buildCreateServicePayload> = null;
    let updatePatch: ReturnType<typeof buildUpdateServicePatch> | null = null;

    if (isEdit && editingService) {
      updatePatch = buildUpdateServicePatch(editingService, activeEditor.draft);
      if (Object.keys(updatePatch.input).length === 0) {
        return;
      }
    } else {
      createPayload = buildCreateServicePayload(activeEditor.draft);
      if (!createPayload) return;
    }

    submittingRef.current = true;
    const attemptIdentity = activeEditor.identity;
    const attemptMode = activeEditor.mode;
    const attemptServiceId = activeEditor.serviceId;
    const attemptDraft = activeEditor.draft;
    const attemptConfirmStatus = activeEditor.confirmStatus;
    const preSubmitIds = servicesState.services.map((item) => item.id);
    const uncertainSpec: ServiceUncertainState =
      isEdit && editingService && updatePatch
        ? {
            kind: "update",
            serviceId: editingService.id,
            expected: updatePatch.expected,
          }
        : {
            kind: "create",
            preSubmitIds,
            expected: createPayload!.expected,
          };
    const operation = isEdit ? "update-service" : "create-service";
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setDialogSession((current) =>
      current.editor && current.editor.identity === attemptIdentity
        ? {
            ...current,
            editor: {
              ...current.editor,
              errors: {},
              saving: true,
              saveError: null,
              statusError: null,
              reconcileNote: null,
              statusFeedback: null,
            },
          }
        : current,
    );

    try {
      if (isEdit && editingService && updatePatch) {
        const updated = await updateService(
          editingService.id,
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
          setDialogSession((current) =>
            recoverAbortedServiceMutation(current, {
              attemptIdentity,
              liveIdentity,
              mode: attemptMode,
              serviceId: attemptServiceId,
              draft: attemptDraft,
              confirmStatus: attemptConfirmStatus,
              uncertain: uncertainSpec,
              error: classifyProviderError(new ApiError("network"), operation),
            }),
          );
          return;
        }
        const refreshed = await servicesState.reloadServices();
        if (currentIdentityRef.current !== attemptIdentity) return;
        if (!refreshed.ok) {
          servicesState.applyServicesLocally((current) =>
            applyLocalServiceMutation(
              current,
              { kind: "update", service: updated },
              servicesState.categories,
            ),
          );
          setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            `${vi.provider.services.feedback.serviceUpdated} ${vi.provider.services.feedback.refreshWarning}`,
          );
          return;
        }
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        setPageFeedback(
          attemptIdentity,
          "success",
          vi.provider.services.feedback.serviceUpdated,
        );
      } else if (createPayload) {
        const created = await createService(createPayload.input, {
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
          setDialogSession((current) =>
            recoverAbortedServiceMutation(current, {
              attemptIdentity,
              liveIdentity,
              mode: attemptMode,
              serviceId: attemptServiceId,
              draft: attemptDraft,
              confirmStatus: attemptConfirmStatus,
              uncertain: uncertainSpec,
              error: classifyProviderError(new ApiError("network"), operation),
            }),
          );
          return;
        }
        const createdMessage =
          profile.approvalStatus === "PENDING"
            ? vi.provider.services.feedback.serviceCreatedPending
            : vi.provider.services.feedback.serviceCreated;
        const refreshed = await servicesState.reloadServices();
        if (currentIdentityRef.current !== attemptIdentity) return;
        if (!refreshed.ok) {
          servicesState.applyServicesLocally((current) =>
            applyLocalServiceMutation(
              current,
              { kind: "create", service: created },
              servicesState.categories,
            ),
          );
          setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            `${createdMessage} ${vi.provider.services.feedback.refreshWarning}`,
          );
          return;
        }
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        setPageFeedback(attemptIdentity, "success", createdMessage);
      }
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setDialogSession((current) =>
          recoverAbortedServiceMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: attemptMode,
            serviceId: attemptServiceId,
            draft: attemptDraft,
            confirmStatus: attemptConfirmStatus,
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
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        return;
      }

      if (info.code === "SERVICE_NOT_FOUND") {
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessage(info),
        );
        void servicesState.reloadServices();
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setDialogSession((current) =>
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

      if (info.code === "CATEGORY_NOT_FOUND") {
        setDialogSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: {
                  ...current.editor,
                  saving: false,
                  saveError: info,
                  errors: {
                    ...current.editor.errors,
                    categoryId: getProviderErrorMessage(info),
                  },
                },
              }
            : current,
        );
        void servicesState.reloadCategories();
        return;
      }

      if (info.code === "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS") {
        setDialogSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: {
                  ...current.editor,
                  saving: false,
                  saveError: info,
                  errors: {
                    ...current.editor.errors,
                    durationMinutes: getProviderErrorMessage(info),
                  },
                },
              }
            : current,
        );
        return;
      }

      if (info.outcome === "unknown") {
        setDialogSession((current) =>
          enterServiceUncertainSession(current, {
            attemptIdentity,
            mode: attemptMode,
            serviceId: attemptServiceId,
            draft: attemptDraft,
            confirmStatus: attemptConfirmStatus,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setDialogSession((current) =>
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

  async function handleConfirmStatusChange() {
    if (
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeEditor ||
      activeEditor.mode !== "edit" ||
      activeEditor.confirmStatus === null ||
      !editingService ||
      !profile ||
      !canManageResources ||
      activeEditor.uncertain !== null ||
      activePendingUncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const targetStatus = activeEditor.confirmStatus;
    const serviceId = editingService.id;
    const categoryInactive = isServiceCategoryInactive(
      editingService,
      servicesState.categories,
      categoriesLoaded,
    );

    submittingRef.current = true;
    const attemptIdentity = activeEditor.identity;
    const attemptDraft = activeEditor.draft;
    const operation =
      targetStatus === "INACTIVE" ? "deactivate-service" : "update-service";
    const uncertainSpec: ServiceUncertainState = {
      kind: "status",
      serviceId,
      targetStatus,
    };
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setDialogSession((current) =>
      current.editor && current.editor.identity === attemptIdentity
        ? {
            ...current,
            editor: {
              ...current.editor,
              updatingStatus: true,
              statusError: null,
              saveError: null,
              reconcileNote: null,
              statusFeedback: null,
            },
          }
        : current,
    );

    try {
      if (targetStatus === "INACTIVE") {
        await deactivateService(serviceId, { signal: controller.signal });
      } else {
        await updateService(
          serviceId,
          { status: "ACTIVE" },
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
        setDialogSession((current) =>
          recoverAbortedServiceMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: "edit",
            serviceId,
            draft: attemptDraft,
            confirmStatus: targetStatus,
            uncertain: uncertainSpec,
            error: classifyProviderError(new ApiError("network"), operation),
          }),
        );
        return;
      }

      const successMessage =
        targetStatus === "INACTIVE"
          ? vi.provider.services.feedback.serviceHidden
          : categoryInactive
            ? vi.provider.services.feedback.serviceShownWithInactiveCategory
            : profile.approvalStatus === "PENDING"
              ? vi.provider.services.feedback.serviceShownPending
              : vi.provider.services.feedback.serviceShown;

      const refreshed = await servicesState.reloadServices();
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (!refreshed.ok) {
        servicesState.applyServicesLocally((current) =>
          targetStatus === "INACTIVE"
            ? applyLocalServiceMutation(
                current,
                { kind: "deactivate", serviceId },
                servicesState.categories,
              )
            : applyLocalServiceMutation(
                current,
                {
                  kind: "update",
                  service: { ...editingService, status: "ACTIVE" },
                },
                servicesState.categories,
              ),
        );
      }

      const fullFeedback = refreshed.ok
        ? successMessage
        : `${successMessage} ${vi.provider.services.feedback.refreshWarning}`;

      setDialogSession((current) =>
        current.editor && current.editor.identity === attemptIdentity
          ? {
              ...current,
              editor: {
                ...current.editor,
                updatingStatus: false,
                confirmStatus: null,
                statusError: null,
                statusFeedback: fullFeedback,
              },
            }
          : current,
      );
      setPageFeedback(attemptIdentity, "success", fullFeedback);
    } catch (err) {
      if (isRequestCancelled(err) || controller.signal.aborted) {
        const liveIdentity = providerSessionIdentityKey(snapshot());
        setDialogSession((current) =>
          recoverAbortedServiceMutation(current, {
            attemptIdentity,
            liveIdentity,
            mode: "edit",
            serviceId,
            draft: attemptDraft,
            confirmStatus: targetStatus,
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
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        return;
      }

      if (info.code === "SERVICE_NOT_FOUND") {
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessage(info),
        );
        void servicesState.reloadServices();
        return;
      }

      if (
        info.code === "PROVIDER_REJECTED_FORBIDDEN" ||
        info.code === "PROVIDER_SUSPENDED_FORBIDDEN"
      ) {
        setDialogSession((current) =>
          current.editor && current.editor.identity === attemptIdentity
            ? {
                ...current,
                editor: {
                  ...current.editor,
                  updatingStatus: false,
                  confirmStatus: null,
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
        setDialogSession((current) =>
          enterServiceUncertainSession(current, {
            attemptIdentity,
            mode: "edit",
            serviceId,
            draft: attemptDraft,
            confirmStatus: targetStatus,
            uncertain: uncertainSpec,
            error: info,
          }),
        );
        return;
      }

      setDialogSession((current) =>
        current.editor && current.editor.identity === attemptIdentity
          ? {
              ...current,
              editor: {
                ...current.editor,
                updatingStatus: false,
                statusError: info,
              },
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

  async function handleReconcile() {
    const pending = activePendingUncertain;
    const uncertain = pending?.uncertain ?? activeEditor?.uncertain ?? null;
    const attemptIdentity = pending?.identity ?? activeEditor?.identity ?? null;
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

    setDialogSession((current) => {
      const baseEditor =
        current.editor && current.editor.identity === attemptIdentity
          ? current.editor
          : current.pendingUncertain &&
              current.pendingUncertain.identity === attemptIdentity
            ? buildServiceEditorFromPending(current.pendingUncertain)
            : null;
      if (!baseEditor) return current;
      return {
        ...current,
        editor: {
          ...baseEditor,
          reconciling: true,
          saveError: null,
          statusError: null,
          reconcileNote: null,
        },
      };
    });

    try {
      const [listResult, profileResult] = await Promise.all([
        servicesState.reloadServices(),
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
        (!profileResult.ok &&
          !profileResult.aborted &&
          (profileResult.error.outcome === "session-ended" ||
            profileResult.error.code === "PROVIDER_PROFILE_NOT_FOUND")) ||
        (!listResult.ok &&
          !listResult.aborted &&
          (listResult.error.outcome === "session-ended" ||
            listResult.error.code === "PROVIDER_PROFILE_NOT_FOUND"))
      ) {
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        return;
      }

      if (!listResult.ok) {
        if (listResult.aborted) {
          setDialogSession((current) =>
            recoverAbortedServiceReconcile(
              current,
              attemptIdentity,
              liveIdentity,
            ),
          );
          return;
        }
        startCooldown(listResult.error.retryAfterSeconds);
        setDialogSession((current) => ({
          ...current,
          pendingUncertain:
            current.pendingUncertain &&
            current.pendingUncertain.identity === attemptIdentity
              ? { ...current.pendingUncertain, error: listResult.error }
              : current.pendingUncertain,
          editor:
            current.editor && current.editor.identity === attemptIdentity
              ? {
                  ...current.editor,
                  reconciling: false,
                  saveError:
                    uncertain.kind === "status" ? null : listResult.error,
                  statusError:
                    uncertain.kind === "status" ? listResult.error : null,
                }
              : current.editor,
        }));
        return;
      }

      const approvalStatus = profileResult.ok
        ? profileResult.profile.approvalStatus
        : profile?.approvalStatus;

      if (uncertain.kind === "create") {
        const result = reconcileServiceCreate(
          uncertain.expected,
          uncertain.preSubmitIds,
          listResult.services,
        );
        if (result.outcome === "created") {
          setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            vi.provider.services.feedback.reconciledCreated,
          );
          return;
        }
        // R3: absence in GET /services/mine never proves an earlier POST stopped
        // (even if the facility is now REJECTED or SUSPENDED); keep pendingUncertain locked!
        const stillUnknownNote =
          approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED"
            ? vi.provider.services.dialog.reconcileStillUnknownLifecycle
            : vi.provider.services.dialog.reconcileStillUnknown;
        setDialogSession((current) =>
          keepServiceCreateStillUnknown(
            current,
            attemptIdentity,
            stillUnknownNote,
          ),
        );
        return;
      }

      if (uncertain.kind === "update") {
        const result = reconcileServiceUpdate(
          uncertain.serviceId,
          uncertain.expected,
          listResult.services,
          approvalStatus,
        );
        if (result.outcome === "saved") {
          setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "success",
            vi.provider.services.feedback.reconciledUpdated,
          );
          return;
        }
        if (result.outcome === "not-found") {
          setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
          setPageFeedback(
            attemptIdentity,
            "error",
            getProviderErrorMessageByCode("SERVICE_NOT_FOUND"),
          );
          return;
        }
        if (result.outcome === "forbidden-lifecycle") {
          setDialogSession((current) =>
            keepServiceUncertainOnLifecycleLock(
              current,
              attemptIdentity,
              lifecycleErrorInfo(result.approvalStatus),
              vi.provider.services.dialog.reconcileUpdateStillUnknownLifecycle,
            ),
          );
          return;
        }
        setDialogSession((current) => {
          const baseEditor =
            current.editor && current.editor.identity === attemptIdentity
              ? current.editor
              : current.pendingUncertain &&
                  current.pendingUncertain.identity === attemptIdentity
                ? buildServiceEditorFromPending(current.pendingUncertain)
                : null;
          if (!baseEditor) return INITIAL_SERVICE_DIALOG_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            editor: {
              ...baseEditor,
              reconciling: false,
              uncertain: null,
              saveError: null,
              reconcileNote: vi.provider.services.dialog.reconcileNotSaved,
            },
          };
        });
        return;
      }

      // uncertain.kind === "status"
      const statusResult = reconcileServiceUpdate(
        uncertain.serviceId,
        { status: uncertain.targetStatus },
        listResult.services,
        approvalStatus,
      );
      if (statusResult.outcome === "saved") {
        const categoryInactive = isServiceCategoryInactive(
          statusResult.service,
          servicesState.categories,
          categoriesLoaded,
        );
        const message =
          uncertain.targetStatus === "ACTIVE" && categoryInactive
            ? vi.provider.services.feedback.serviceShownWithInactiveCategory
            : vi.provider.services.feedback.reconciledStatus;
        setDialogSession((current) => {
          if (!current.dialogOpen) return INITIAL_SERVICE_DIALOG_SESSION;
          const baseEditor =
            current.editor && current.editor.identity === attemptIdentity
              ? current.editor
              : null;
          if (!baseEditor) return INITIAL_SERVICE_DIALOG_SESSION;
          return {
            dialogOpen: true,
            pendingUncertain: null,
            editor: {
              ...baseEditor,
              reconciling: false,
              uncertain: null,
              confirmStatus: null,
              statusError: null,
              statusFeedback: message,
            },
          };
        });
        setPageFeedback(attemptIdentity, "success", message);
        return;
      }
      if (statusResult.outcome === "not-found") {
        setDialogSession(INITIAL_SERVICE_DIALOG_SESSION);
        setPageFeedback(
          attemptIdentity,
          "error",
          getProviderErrorMessageByCode("SERVICE_NOT_FOUND"),
        );
        return;
      }
      if (statusResult.outcome === "forbidden-lifecycle") {
        setDialogSession((current) =>
          keepServiceUncertainOnLifecycleLock(
            current,
            attemptIdentity,
            lifecycleErrorInfo(statusResult.approvalStatus),
            vi.provider.services.dialog.reconcileUpdateStillUnknownLifecycle,
          ),
        );
        return;
      }
      setDialogSession((current) => {
        const baseEditor =
          current.editor && current.editor.identity === attemptIdentity
            ? current.editor
            : current.pendingUncertain &&
                current.pendingUncertain.identity === attemptIdentity
              ? buildServiceEditorFromPending(current.pendingUncertain)
              : null;
        if (!baseEditor) return INITIAL_SERVICE_DIALOG_SESSION;
        return {
          dialogOpen: true,
          pendingUncertain: null,
          editor: {
            ...baseEditor,
            reconciling: false,
            uncertain: null,
            statusError: null,
            reconcileNote:
              vi.provider.services.dialog.reconcileStatusNotSaved,
          },
        };
      });
    } finally {
      submittingRef.current = false;
    }
  }

  const pageLocale = vi.provider.services.page;
  const sessionLocale = vi.provider.workspace.session;
  const isReloadingAny =
    profileState.reloading || servicesState.servicesReloading;

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

  return (
    <div className={styles.page} lang="vi">
      <div className={styles.providerTab}>{pageLocale.providerTab}</div>

      <header className={styles.intro}>
        <div>
          <h1 id="services-title" tabIndex={-1}>
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
              className={styles.addButton}
              disabled={!canCreate}
              onClick={openCreate}
            >
              {pageLocale.addService}
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
          aria-labelledby="services-session-error"
        >
          <h2 id="services-session-error">{sessionLocale.errorTitle}</h2>
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

              {servicesState.servicesRefreshError && (
                <p className={styles.error} role="alert">
                  {getProviderErrorMessage(
                    servicesState.servicesRefreshError,
                    cooldownSeconds,
                  )}
                </p>
              )}

              {!showDialog && activePendingUncertain && (
                <section
                  className={styles.pendingUncertainBanner}
                  role="alert"
                  aria-live="polite"
                >
                  <h2>{vi.provider.services.dialog.pendingBannerTitle}</h2>
                  <p>
                    {activePendingUncertain.uncertain.kind === "create"
                      ? vi.provider.services.dialog
                          .pendingCreateBannerDescription
                      : activePendingUncertain.uncertain.kind === "update"
                        ? vi.provider.services.dialog
                            .pendingUpdateBannerDescription
                        : vi.provider.services.dialog
                            .pendingStatusBannerDescription}
                  </p>
                  {activePendingUncertain.reconcileNote && (
                    <p role="status">{activePendingUncertain.reconcileNote}</p>
                  )}
                  {activePendingUncertain.error && (
                    <p>
                      {getProviderErrorMessage(
                        activePendingUncertain.error,
                        cooldownSeconds,
                      )}
                    </p>
                  )}
                  <div className={styles.pendingUncertainActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={
                        Boolean(activeEditor?.reconciling) ||
                        sessionBoundary.lockActions ||
                        cooldownSeconds > 0
                      }
                      onClick={() => void handleReconcile()}
                    >
                      <RefreshCw
                        aria-hidden="true"
                        focusable="false"
                        size={14}
                        className={styles.inlineIcon}
                      />{" "}
                      {activeEditor?.reconciling
                        ? vi.provider.services.dialog.reconciling
                        : vi.provider.services.dialog.reconcileAction}
                    </button>
                    <button
                      type="button"
                      className={styles.softButton}
                      disabled={
                        Boolean(activeEditor?.reconciling) ||
                        sessionBoundary.lockActions
                      }
                      onClick={reopenPendingUncertain}
                    >
                      {vi.provider.services.dialog.reviewRequest}
                    </button>
                  </div>
                </section>
              )}

              {!showDialog && (
                <ServicesFeedback feedback={activeFeedback} focus={false} />
              )}

              {servicesState.servicesStatus === "ready" && (
                <ServicesSummary
                  services={servicesState.services}
                  activeCategories={servicesState.categories}
                  categoriesLoaded={categoriesLoaded}
                />
              )}

              <ServicesToolbar
                status={filters.status}
                categoryId={filters.categoryId}
                rawQuery={rawQuery}
                categoryOptions={categoryFilterOptions}
                onChangeStatus={(nextStatus) =>
                  setFilters((current) => ({ ...current, status: nextStatus }))
                }
                onChangeCategory={(nextCategoryId) =>
                  setFilters((current) => ({
                    ...current,
                    categoryId: nextCategoryId,
                  }))
                }
                onChangeRawQuery={setRawQuery}
                onCommitQuery={(nextQuery) =>
                  setFilters((current) =>
                    current.query === nextQuery
                      ? current
                      : { ...current, query: nextQuery },
                  )
                }
              />

              <ServicesList
                status={servicesState.servicesStatus}
                services={filteredServices}
                total={servicesState.services.length}
                activeCategories={servicesState.categories}
                categoriesLoaded={categoriesLoaded}
                canManageResources={canManageResources}
                error={servicesState.servicesError}
                reloading={servicesState.servicesReloading}
                cooldownSeconds={cooldownSeconds}
                onSelect={openEdit}
                onCreate={openCreate}
                onClearFilters={handleClearFilters}
                onRetry={() => void handleRetryServices()}
              />

              <ServicesGuidance />
            </>
          )}
        </>
      )}

      {showDialog && activeEditor && (
        <ServiceDialog
          editor={activeEditor}
          service={editingService}
          categories={servicesState.categories}
          categoriesStatus={servicesState.categoriesStatus}
          categoriesError={servicesState.categoriesError}
          canManageResources={canManageResources}
          hasChanges={hasChanges}
          locked={sessionBoundary.lockActions}
          cooldownSeconds={cooldownSeconds}
          onChangeField={changeDraftField}
          onReloadCategories={() => void servicesState.reloadCategories()}
          onSave={() => void handleSave()}
          onRequestStatusChange={requestStatusChange}
          onCancelStatusChange={cancelStatusChange}
          onConfirmStatusChange={() => void handleConfirmStatusChange()}
          onReconcile={() => void handleReconcile()}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
