"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { loadTurnstileScript, type TurnstileRenderOptions } from "@/features/auth/turnstile/loadTurnstileScript";
import { getTurnstileSiteKey, type TurnstileAction } from "@/features/auth/turnstile/turnstileConfig";
import { createTurnstileController, type TurnstileController } from "@/features/auth/turnstile/turnstileController";

export type TurnstileWidgetHandle = {
  /** Clears the current challenge/token and starts a new one. Safe to call after unmount. */
  reset: () => void;
};

export type TurnstileWidgetProps = {
  action: TurnstileAction;
  /** Defaults to NEXT_PUBLIC_TURNSTILE_SITE_KEY. */
  siteKey?: string | null;
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: (errorCode?: string) => void;
  onTimeout?: () => void;
  /** Widget rendered and waiting for the challenge. */
  onReady?: () => void;
  /** Widget cannot be shown (missing site key, script blocked or timed out). */
  onUnavailable?: () => void;
  /** Change to tear down and load/render the widget again (e.g. after a script failure). */
  reloadKey?: number;
  size?: TurnstileRenderOptions["size"];
  className?: string;
  ref?: Ref<TurnstileWidgetHandle>;
};

type Handlers = Pick<TurnstileWidgetProps, "onToken" | "onExpire" | "onError" | "onTimeout" | "onReady" | "onUnavailable">;

/**
 * Explicitly rendered Cloudflare Turnstile widget.
 * One widget per mount; destroyed on unmount (also under React Strict Mode's double effect run).
 * Handlers are read through a ref, so parent re-renders never reset the challenge.
 */
export default function TurnstileWidget({ action, siteKey, reloadKey = 0, size = "flexible", className, ref, ...handlers }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<TurnstileController | null>(null);
  const handlersRef = useRef<Handlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useImperativeHandle(ref, () => ({ reset: () => controllerRef.current?.reset() }), []);

  const resolvedSiteKey = siteKey === undefined ? getTurnstileSiteKey() : siteKey;

  useEffect(() => {
    if (!resolvedSiteKey) {
      handlersRef.current.onUnavailable?.();
      return;
    }

    let cancelled = false;
    let controller: TurnstileController | null = null;

    loadTurnstileScript()
      .then((api) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        controller = createTurnstileController({
          api,
          container,
          siteKey: resolvedSiteKey,
          action,
          size,
          getHandlers: () => ({
            onToken: (token) => handlersRef.current.onToken(token),
            onExpire: () => handlersRef.current.onExpire(),
            onError: (code) => handlersRef.current.onError(code),
            onTimeout: () => (handlersRef.current.onTimeout ?? handlersRef.current.onError)(),
          }),
        });
        controllerRef.current = controller;
        handlersRef.current.onReady?.();
      })
      .catch(() => {
        if (!cancelled) handlersRef.current.onUnavailable?.();
      });

    return () => {
      cancelled = true;
      controller?.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [action, resolvedSiteKey, size, reloadKey]);

  // Reserve the widget's height (65px for normal/flexible) to avoid layout shift.
  return <div ref={containerRef} className={className ?? "min-h-[65px] w-full"} data-turnstile-action={action} />;
}
