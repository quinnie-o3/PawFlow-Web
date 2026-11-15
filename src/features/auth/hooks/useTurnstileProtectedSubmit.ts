"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { TurnstileWidgetHandle, TurnstileWidgetProps } from "@/components/auth/TurnstileWidget";
import { AuthApiError } from "../services/authApi";
import { createProtectedSubmitter, type ProtectedSubmitter } from "../turnstile/protectedSubmit";
import type { TurnstileAction } from "../turnstile/turnstileConfig";
import { initialTurnstileTokenState, turnstileTokenReducer, type TurnstileStatus } from "../turnstile/turnstileTokenState";

export type TurnstileProtectedSubmit = {
  status: TurnstileStatus;
  hasToken: boolean;
  isSubmitting: boolean;
  /** Seconds left before the server allows another attempt (429 / 503 Retry-After), else 0. */
  cooldownSeconds: number;
  /** Form may be submitted: fresh token, nothing in flight, no cooldown. */
  canSubmit: boolean;
  /** Runs `send` with a fresh token; resets the widget afterwards whatever the outcome. */
  submit: <T>(send: (turnstileToken: string) => Promise<T>) => Promise<T>;
  /** Manual recovery after a widget error/expiry/script failure. */
  retryChallenge: () => void;
  /** Props for <TurnstileWidget>. */
  widgetProps: TurnstileWidgetProps;
};

/**
 * Token lifecycle for one Turnstile-protected form. The token lives only in this
 * component's memory (never in storage, URL, global state or logs) and is single use.
 */
export function useTurnstileProtectedSubmit(action: TurnstileAction): TurnstileProtectedSubmit {
  const [state, dispatch] = useReducer(turnstileTokenReducer, initialTurnstileTokenState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  // Synchronous copy of the token so a double click cannot read it twice.
  const tokenRef = useRef<string | null>(null);
  const cooldownUntilRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const statusRef = useRef<TurnstileStatus>(state.status);

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current = null;
    };
  }, []);

  const resetChallenge = useCallback(() => {
    tokenRef.current = null;
    if (!mountedRef.current) return;
    dispatch({ type: "reset" });
    widgetRef.current?.reset();
  }, []);

  // Created lazily inside the submit handler (never during render).
  const submitterRef = useRef<ProtectedSubmitter | null>(null);
  const getSubmitter = useCallback(() => {
    submitterRef.current ??= createProtectedSubmitter({
      takeToken: () => {
        const token = tokenRef.current;
        tokenRef.current = null;
        if (token) dispatch({ type: "consumed" });
        return token;
      },
      resetChallenge,
      isCoolingDown: () => cooldownUntilRef.current !== null && cooldownUntilRef.current > Date.now(),
    });
    return submitterRef.current;
  }, [resetChallenge]);

  const startCooldown = useCallback((seconds: number) => {
    const until = Date.now() + seconds * 1000;
    cooldownUntilRef.current = until;
    setCooldownUntil(until);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) {
        cooldownUntilRef.current = null;
        setCooldownUntil(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const submit = useCallback(
    async <T,>(send: (turnstileToken: string) => Promise<T>): Promise<T> => {
      setIsSubmitting(true);
      try {
        return await getSubmitter().submit(send);
      } catch (error) {
        if (error instanceof AuthApiError && error.retryAfterSeconds && mountedRef.current) {
          startCooldown(error.retryAfterSeconds);
        }
        throw error;
      } finally {
        if (mountedRef.current) setIsSubmitting(false);
      }
    },
    [getSubmitter, startCooldown],
  );

  const retryChallenge = useCallback(() => {
    tokenRef.current = null;
    if (statusRef.current === "unavailable") {
      dispatch({ type: "reload" });
      setReloadKey((key) => key + 1);
      return;
    }
    resetChallenge();
  }, [resetChallenge]);

  const widgetProps = useMemo<TurnstileWidgetProps>(
    () => ({
      action,
      ref: widgetRef,
      reloadKey,
      onReady: () => dispatch({ type: "ready" }),
      onToken: (token) => {
        tokenRef.current = token;
        dispatch({ type: "token", token });
      },
      onExpire: () => {
        // Expired tokens are useless: drop it and start a new challenge right away.
        tokenRef.current = null;
        dispatch({ type: "expired" });
        widgetRef.current?.reset();
      },
      onError: () => {
        tokenRef.current = null;
        dispatch({ type: "error" });
      },
      onTimeout: () => {
        tokenRef.current = null;
        dispatch({ type: "timeout" });
      },
      onUnavailable: () => {
        tokenRef.current = null;
        dispatch({ type: "unavailable" });
      },
    }),
    [action, reloadKey],
  );

  const cooldownSeconds = cooldownUntil === null ? 0 : Math.max(Math.ceil((cooldownUntil - now) / 1000), 0);
  const hasToken = state.status === "verified" && state.token !== null;

  return {
    status: state.status,
    hasToken,
    isSubmitting,
    cooldownSeconds,
    canSubmit: hasToken && !isSubmitting && cooldownSeconds === 0,
    submit,
    retryChallenge,
    widgetProps,
  };
}
