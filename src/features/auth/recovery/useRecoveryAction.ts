"use client";
import { useEffect, useRef, useState } from "react";
import { vi } from "@/lib/locale";
import { MockRecoveryError } from "./types";

export function useRecoveryAction() {
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failNext, setFailNext] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(action: (signal: AbortSignal, fail: boolean) => Promise<void>) {
    if (controller.current) return false;
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setError(null);
    const fail = failNext;
    setFailNext(false);
    try {
      await action(request.signal, fail);
      return !request.signal.aborted;
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof MockRecoveryError ? vi.auth.mock.errors[failure.code] : vi.auth.mock.errors.failure);
      return false;
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }
  return { pending, error, failNext, setFailNext, clearError: () => setError(null), run };
}
