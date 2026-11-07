"use client";

import { useEffect, useRef, useState } from "react";
import { vi } from "@/lib/locale";
import { AuthRequestError } from "../services/authError";

/** One in-flight request; token and routing policy remain with each real Auth flow. */
export function useAuthSubmission<T>() {
  const controller = useRef<AbortController | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [requestError, setError] = useState<AuthRequestError | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(action: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setSubmitting(true);
    setError(null);
    try {
      const result = await action(request.signal);
      return request.signal.aborted ? undefined : result;
    } catch (error) {
      if (request.signal.aborted) return;
      const failure = error instanceof AuthRequestError ? error : new AuthRequestError(vi.auth.feedback.networkError);
      setError(failure);
      throw failure;
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setSubmitting(false);
    }
  }
  return { isSubmitting, requestError, submit, clearError: () => setError(null) };
}
