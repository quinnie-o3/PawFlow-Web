"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import { isRequestCancelled } from "@/lib/api/errors";
import { vi } from "@/lib/locale";
import {
  classifyProviderError,
  updateProviderProfile,
} from "@/features/provider-workspace/liveApi";
import { useProviderProfile } from "@/features/provider-workspace/useProviderProfile";
import {
  buildProfileUpdatePatch,
  hasProfileDraftChanges,
  profileSectionFields,
  profileToFormValues,
  reconcileProfileUpdate,
} from "../profileLogic";
import { validateProfileDraft } from "../profileValidation";
import type {
  ProfileEditSection,
  ProfileEditorState,
  ProfileFormValues,
} from "../types";
import ProfileApproval from "./ProfileApproval";
import ProfileEditDialog from "./ProfileEditDialog";
import ProfileImages from "./ProfileImages";
import ProfileInformation from "./ProfileInformation";
import ProfileModulesOverview from "./ProfileModulesOverview";
import styles from "../profile.module.css";

type ScopedFeedback = Readonly<{
  identity: string;
  message: string;
}>;

export default function ProviderProfilePage() {
  const profileState = useProviderProfile();
  const { sessionBoundary, owner, status, profile, permissions } = profileState;

  const [editor, setEditor] = useState<ProfileEditorState | null>(null);
  const [feedback, setFeedback] = useState<ScopedFeedback | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const submittingRef = useRef(false);
  const reconcilingRef = useRef(false);
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

  // On 401/logout/identity switch, abort in-flight mutations and purge drafts asynchronously.
  // On same-identity revalidate error (resetPrivateState === false), keep draft in memory.
  useEffect(() => {
    if (!sessionBoundary.resetPrivateState) return;
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = null;
    submittingRef.current = false;
    reconcilingRef.current = false;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setEditor(null);
      setFeedback(null);
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
    editor !== null &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    editor.identity === sessionBoundary.identity
      ? editor
      : null;

  const activeFeedback =
    feedback !== null &&
    !sessionBoundary.hidePrivateData &&
    !sessionBoundary.resetPrivateState &&
    sessionBoundary.identity !== null &&
    feedback.identity === sessionBoundary.identity
      ? feedback.message
      : null;

  const canUpdateProfile = Boolean(permissions?.canUpdateProfile);
  const canEdit =
    status === "ready" &&
    profile !== null &&
    canUpdateProfile &&
    !sessionBoundary.lockActions;

  const hasChanges =
    activeEditor !== null && profile !== null
      ? hasProfileDraftChanges(
          profile,
          activeEditor.draft,
          activeEditor.section,
        )
      : false;

  // Unmount <dialog> whenever private data must be hidden (including revalidate error)
  // so native top-layer backdrop & scroll lock never obscure retrySession() or leak PII.
  const showDialog =
    activeEditor !== null &&
    !sessionBoundary.closeDialog &&
    !sessionBoundary.hidePrivateData &&
    status === "ready" &&
    profile !== null;

  function openEditor(section: ProfileEditSection) {
    if (
      !profile ||
      !canUpdateProfile ||
      sessionBoundary.lockActions ||
      !sessionBoundary.identity
    ) {
      return;
    }
    setFeedback(null);
    setEditor({
      identity: sessionBoundary.identity,
      section,
      draft: profileToFormValues(profile),
      errors: {},
      saving: false,
      reconciling: false,
      saveError: null,
      uncertain: null,
      reconcileNote: null,
    });
  }

  function closeEditor() {
    if (submittingRef.current || reconcilingRef.current) return;
    setEditor(null);
  }

  function changeDraftField(field: keyof ProfileFormValues, value: string) {
    setEditor((current) => {
      if (
        !current ||
        current.saving ||
        current.reconciling ||
        current.uncertain !== null ||
        !profileSectionFields(current.section).includes(field)
      ) {
        return current;
      }
      const nextErrors = { ...current.errors };
      delete nextErrors[field];
      return {
        ...current,
        draft: { ...current.draft, [field]: value },
        errors: nextErrors,
        saveError: null,
        reconcileNote: null,
      };
    });
  }

  async function handleReload() {
    if (sessionBoundary.lockActions || cooldownSeconds > 0) return;
    const result = await profileState.reload();
    if (!result.ok && !result.aborted) {
      startCooldown(result.error.retryAfterSeconds);
    }
  }

  async function handleSave() {
    if (
      submittingRef.current ||
      reconcilingRef.current ||
      sessionBoundary.lockActions ||
      !activeEditor ||
      !profile ||
      !canUpdateProfile ||
      activeEditor.uncertain !== null ||
      cooldownSeconds > 0
    ) {
      return;
    }

    const validationErrors = validateProfileDraft(
      activeEditor.draft,
      activeEditor.section,
    );
    const firstErrorField = (
      Object.keys(validationErrors) as (keyof ProfileFormValues)[]
    ).find((key) => Boolean(validationErrors[key]));
    if (firstErrorField) {
      setEditor((current) =>
        current ? { ...current, errors: validationErrors } : current,
      );
      window.requestAnimationFrame(() => {
        document.getElementById(`profile-${firstErrorField}`)?.focus();
      });
      return;
    }

    const patch = buildProfileUpdatePatch(
      profile,
      activeEditor.draft,
      activeEditor.section,
    );
    if (Object.keys(patch).length === 0) return;

    submittingRef.current = true;
    const attemptIdentity = activeEditor.identity;
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;

    setEditor((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            errors: {},
            saving: true,
            saveError: null,
            reconcileNote: null,
          }
        : current,
    );

    try {
      const updated = await updateProviderProfile(patch, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }
      profileState.applyProfile(updated);
      setEditor(null);
      setFeedback({
        identity: attemptIdentity,
        message: vi.provider.profile.feedback.saved,
      });
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        currentIdentityRef.current !== attemptIdentity
      ) {
        return;
      }

      const info = classifyProviderError(err, "update-profile");
      if (info.outcome === "session-ended") {
        setEditor(null);
        return;
      }

      startCooldown(info.retryAfterSeconds);

      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        profileState.markNotFound();
        setEditor(null);
        return;
      }

      if (info.code === "PROVIDER_SUSPENDED_READONLY") {
        setEditor((current) =>
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

      if (info.outcome === "unknown") {
        // Never auto-retry PATCH when server outcome is unknown; preserve draft for explicit GET reconcile.
        setEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                saving: false,
                saveError: info,
                uncertain: { payload: patch },
                reconcileNote: null,
              }
            : current,
        );
        return;
      }

      setEditor((current) =>
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

  async function handleReconcile() {
    if (
      reconcilingRef.current ||
      submittingRef.current ||
      sessionBoundary.lockActions ||
      !activeEditor?.uncertain ||
      cooldownSeconds > 0
    ) {
      return;
    }

    reconcilingRef.current = true;
    const attemptIdentity = activeEditor.identity;
    const sentPayload = activeEditor.uncertain.payload;

    setEditor((current) =>
      current && current.identity === attemptIdentity
        ? {
            ...current,
            reconciling: true,
            saveError: null,
            reconcileNote: null,
          }
        : current,
    );

    try {
      const result = await profileState.reload();
      if (currentIdentityRef.current !== attemptIdentity) return;

      if (!result.ok) {
        if (result.aborted) {
          setEditor((current) =>
            current && current.identity === attemptIdentity
              ? { ...current, reconciling: false }
              : current,
          );
          return;
        }
        if (
          result.error.outcome === "session-ended" ||
          result.error.code === "PROVIDER_PROFILE_NOT_FOUND"
        ) {
          setEditor(null);
          return;
        }
        startCooldown(result.error.retryAfterSeconds);
        setEditor((current) =>
          current && current.identity === attemptIdentity
            ? { ...current, reconciling: false, saveError: result.error }
            : current,
        );
        return;
      }

      const outcome = reconcileProfileUpdate(sentPayload, result.profile);
      if (outcome === "saved") {
        setEditor(null);
        setFeedback({
          identity: attemptIdentity,
          message: vi.provider.profile.feedback.reconciledSaved,
        });
        return;
      }

      if (outcome === "suspended") {
        setEditor((current) =>
          current && current.identity === attemptIdentity
            ? {
                ...current,
                reconciling: false,
                uncertain: null,
                saveError: {
                  code: "PROVIDER_SUSPENDED_READONLY",
                  category: "lifecycle",
                  outcome: "definite-failure",
                  status: 403,
                  retryAfterSeconds: null,
                  shouldReconcile: false,
                },
                reconcileNote: null,
              }
            : current,
        );
        return;
      }

      setEditor((current) =>
        current && current.identity === attemptIdentity
          ? {
              ...current,
              reconciling: false,
              uncertain: null,
              saveError: null,
              reconcileNote: vi.provider.profile.dialog.reconcileNotSaved,
            }
          : current,
      );
    } finally {
      reconcilingRef.current = false;
    }
  }

  const pageLocale = vi.provider.profile.page;
  const sessionLocale = vi.provider.workspace.session;

  return (
    <div className={styles.page} lang="vi">
      <div className={styles.providerTab}>{pageLocale.providerTab}</div>

      <header className={styles.intro}>
        <div>
          <h1 id="profile-title" tabIndex={-1}>
            {pageLocale.title}
          </h1>
          <p>{pageLocale.description}</p>
        </div>

        {status === "ready" && profile && !sessionBoundary.hidePrivateData && (
          <div className={styles.introActions}>
            <button
              type="button"
              className={styles.outlineButton}
              disabled={profileState.reloading || cooldownSeconds > 0 || sessionBoundary.lockActions}
              onClick={() => void handleReload()}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {pageLocale.reload}
            </button>
            <button
              type="button"
              className={styles.outlineButton}
              disabled={!canEdit}
              onClick={() => openEditor("all")}
            >
              <Pencil aria-hidden="true" size={14} />
              {pageLocale.edit}
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
          <div className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} />
          <div className={`${styles.skeletonBar} ${styles.skeletonBarLong}`} />
          <p className="sr-only">{sessionLocale.pending}</p>
        </div>
      ) : sessionBoundary.mode === "session-error" ? (
        <section className={styles.sessionNotice} aria-labelledby="profile-session-error">
          <h2 id="profile-session-error">{sessionLocale.errorTitle}</h2>
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
          <p className={styles.help}>{pageLocale.liveHint}</p>

          {activeFeedback && (
            <p className={styles.feedback} role="status">
              {activeFeedback}
            </p>
          )}

          <ProfileApproval
            status={status}
            profile={profile}
            error={profileState.error}
            refreshError={profileState.refreshError}
            reloading={profileState.reloading}
            cooldownSeconds={cooldownSeconds}
            onReload={() => void handleReload()}
          />

          {status === "loading" && (
            <div className={styles.skeletonCard} aria-hidden="true">
              <div
                className={`${styles.skeletonBar} ${styles.skeletonBarShort}`}
              />
              <div
                className={`${styles.skeletonBar} ${styles.skeletonBarLong}`}
              />
              <div
                className={`${styles.skeletonBar} ${styles.skeletonBarLong}`}
              />
            </div>
          )}

          {status === "ready" && profile && (
            <>
              <ProfileInformation
                profile={profile}
                owner={owner}
                canUpdateProfile={canUpdateProfile}
                locked={sessionBoundary.lockActions}
                onEdit={openEditor}
              />
              <ProfileImages />
              <ProfileModulesOverview
                identity={sessionBoundary.identity}
                enabled={status === "ready"}
                hidePrivateData={sessionBoundary.hidePrivateData}
              />
            </>
          )}
        </>
      )}

      {showDialog && activeEditor && profile && (
        <ProfileEditDialog
          profile={profile}
          owner={owner}
          editor={activeEditor}
          hasChanges={hasChanges}
          canUpdateProfile={canUpdateProfile}
          locked={sessionBoundary.lockActions}
          cooldownSeconds={cooldownSeconds}
          onChange={changeDraftField}
          onSave={() => void handleSave()}
          onReconcile={() => void handleReconcile()}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
