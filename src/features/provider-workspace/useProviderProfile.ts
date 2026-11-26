"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRequestCancelled } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/queryCache";
import { privateCache } from "@/features/session/client";
import { useSession } from "@/features/session/SessionProvider";
import {
  classifyProviderError,
  getProviderProfile,
  type ProviderApiErrorInfo,
  type ProviderProfile,
} from "./liveApi";
import {
  evaluateProviderSessionBoundary,
  getProviderLifecyclePermissions,
  type ProviderLifecyclePermissions,
  type ProviderSessionBoundaryDecision,
  type ProviderSessionUser,
} from "./lifecycle";

export type ProviderProfileLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "not-found"
  | "error";

export type ReloadProviderProfileResult =
  | Readonly<{ ok: true; profile: ProviderProfile }>
  | Readonly<{ ok: false; error: ProviderApiErrorInfo; aborted?: false }>
  | Readonly<{ ok: false; aborted: true }>;

type FetchedProfileState = Readonly<{
  identity: string | null;
  status: "ready" | "not-found" | "error" | null;
  profile: ProviderProfile | null;
  error: ProviderApiErrorInfo | null;
  reloading: boolean;
  refreshError: ProviderApiErrorInfo | null;
}>;

const EMPTY_FETCHED: FetchedProfileState = {
  identity: null,
  status: null,
  profile: null,
  error: null,
  reloading: false,
  refreshError: null,
};

export type UseProviderProfileResult = Readonly<{
  sessionBoundary: ProviderSessionBoundaryDecision;
  owner: ProviderSessionUser | null;
  status: ProviderProfileLoadStatus;
  profile: ProviderProfile | null;
  permissions: ProviderLifecyclePermissions | null;
  reloading: boolean;
  error: ProviderApiErrorInfo | null;
  refreshError: ProviderApiErrorInfo | null;
  reload: () => Promise<ReloadProviderProfileResult>;
  applyProfile: (next: ProviderProfile) => void;
  markNotFound: () => void;
}>;

export function useProviderProfile(): UseProviderProfileResult {
  const sessionState = useSession();
  const [fetched, setFetched] = useState<FetchedProfileState>(EMPTY_FETCHED);

  const sessionBoundary = evaluateProviderSessionBoundary(
    fetched.identity,
    sessionState,
  );
  const { canFetchPrivate, identity, resetPrivateState, hidePrivateData } =
    sessionBoundary;

  const owner: ProviderSessionUser | null =
    sessionBoundary.mode === "owner" && sessionState.session?.user
      ? sessionState.session.user
      : null;

  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const currentIdentityRef = useRef<string | null>(null);
  const canFetchRef = useRef(false);

  useEffect(() => {
    currentIdentityRef.current = identity;
    canFetchRef.current = canFetchPrivate;
  }, [identity, canFetchPrivate]);

  // Purge stale private state from memory asynchronously on 401/logout/identity switch.
  useEffect(() => {
    if (!resetPrivateState) return;
    requestIdRef.current++;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setFetched(EMPTY_FETCHED);
    });
    return () => {
      cancelled = true;
    };
  }, [resetPrivateState]);

  // Fetch live profile via privateCache/getProviderProfile when an owner identity is active.
  useEffect(() => {
    if (!canFetchPrivate || !identity) {
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    activeControllerRef.current?.abort();
    activeControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const targetIdentity = identity;

    const cached = privateCache.read<ProviderProfile>(
      queryKeys.provider.profile(),
    );
    if (cached) {
      Promise.resolve().then(() => {
        if (
          controller.signal.aborted ||
          requestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetched({
          identity: targetIdentity,
          status: "ready",
          profile: cached,
          error: null,
          reloading: false,
          refreshError: null,
        });
      });
    }

    getProviderProfile({ signal: controller.signal }).then(
      (profile) => {
        if (
          controller.signal.aborted ||
          requestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        setFetched({
          identity: targetIdentity,
          status: "ready",
          profile,
          error: null,
          reloading: false,
          refreshError: null,
        });
      },
      (err) => {
        if (
          isRequestCancelled(err) ||
          controller.signal.aborted ||
          requestIdRef.current !== requestId ||
          currentIdentityRef.current !== targetIdentity
        ) {
          return;
        }
        const info = classifyProviderError(err, "get-profile");
        if (info.outcome === "session-ended") {
          setFetched(EMPTY_FETCHED);
          return;
        }
        if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
          setFetched({
            identity: targetIdentity,
            status: "not-found",
            profile: null,
            error: info,
            reloading: false,
            refreshError: null,
          });
          return;
        }
        setFetched((current) =>
          current.identity === targetIdentity && current.profile
            ? {
                ...current,
                reloading: false,
                refreshError: info,
              }
            : {
                identity: targetIdentity,
                status: "error",
                profile: null,
                error: info,
                reloading: false,
                refreshError: null,
              },
        );
      },
    );

    return () => {
      controller.abort();
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    };
  }, [canFetchPrivate, identity]);

  const reload = useCallback(async (): Promise<ReloadProviderProfileResult> => {
    const targetIdentity = currentIdentityRef.current;
    if (!canFetchRef.current || !targetIdentity) {
      return { ok: false, aborted: true };
    }

    const controller = new AbortController();
    activeControllerRef.current?.abort();
    activeControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setFetched((current) =>
      current.identity === targetIdentity
        ? { ...current, reloading: true, refreshError: null }
        : {
            identity: targetIdentity,
            status: null,
            profile: null,
            error: null,
            reloading: true,
            refreshError: null,
          },
    );

    try {
      const profile = await getProviderProfile({ signal: controller.signal });
      if (
        controller.signal.aborted ||
        requestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      setFetched({
        identity: targetIdentity,
        status: "ready",
        profile,
        error: null,
        reloading: false,
        refreshError: null,
      });
      return { ok: true, profile };
    } catch (err) {
      if (
        isRequestCancelled(err) ||
        controller.signal.aborted ||
        requestIdRef.current !== requestId ||
        currentIdentityRef.current !== targetIdentity
      ) {
        return { ok: false, aborted: true };
      }
      const info = classifyProviderError(err, "get-profile");
      if (info.outcome === "session-ended") {
        setFetched(EMPTY_FETCHED);
        return { ok: false, error: info };
      }
      if (info.code === "PROVIDER_PROFILE_NOT_FOUND") {
        setFetched({
          identity: targetIdentity,
          status: "not-found",
          profile: null,
          error: info,
          reloading: false,
          refreshError: null,
        });
        return { ok: false, error: info };
      }
      setFetched((current) =>
        current.identity === targetIdentity && current.profile
          ? { ...current, reloading: false, refreshError: info }
          : {
              identity: targetIdentity,
              status: "error",
              profile: null,
              error: info,
              reloading: false,
              refreshError: null,
            },
      );
      return { ok: false, error: info };
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  }, []);

  const applyProfile = useCallback((next: ProviderProfile) => {
    const targetIdentity = currentIdentityRef.current;
    if (!targetIdentity) return;
    setFetched({
      identity: targetIdentity,
      status: "ready",
      profile: next,
      error: null,
      reloading: false,
      refreshError: null,
    });
  }, []);

  const markNotFound = useCallback(() => {
    const targetIdentity = currentIdentityRef.current;
    if (!targetIdentity) return;
    setFetched({
      identity: targetIdentity,
      status: "not-found",
      profile: null,
      error: null,
      reloading: false,
      refreshError: null,
    });
  }, []);

  const matchesIdentity =
    !hidePrivateData &&
    !resetPrivateState &&
    identity !== null &&
    fetched.identity === identity;

  const status: ProviderProfileLoadStatus =
    hidePrivateData || resetPrivateState
      ? "idle"
      : !matchesIdentity || fetched.status === null
        ? "loading"
        : fetched.status;

  const profile =
    matchesIdentity && fetched.status === "ready" ? fetched.profile : null;
  const permissions = profile
    ? getProviderLifecyclePermissions(profile.approvalStatus)
    : null;
  const error = matchesIdentity ? fetched.error : null;
  const refreshError = matchesIdentity ? fetched.refreshError : null;
  const reloading = matchesIdentity ? fetched.reloading : false;

  return {
    sessionBoundary,
    owner,
    status,
    profile,
    permissions,
    reloading,
    error,
    refreshError,
    reload,
    applyProfile,
    markNotFound,
  };
}
