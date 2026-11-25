"use client";

import { bootstrap, acceptSession, snapshot, notifySessionChange } from "../../session/client";
import { vi } from "@/lib/locale";
import { useEffect, useRef, useState } from "react";
import { isRequestCancelled, throwIfCancelled } from "../../../lib/api/errors";
import { AuthApiError } from "../services/authApi";

import { loginCustomer, type LoginCustomerPayload } from "../services/loginCustomer";

export function useLoginCustomer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function submitLogin(payload: LoginCustomerPayload) {
    requestRef.current?.abort();
    const current = new AbortController();
    requestRef.current = current;
    setIsSubmitting(true);
    setError(null);
    try {
      if (!snapshot().session) await bootstrap();
      throwIfCancelled(current.signal);
      const response = await loginCustomer(payload, { signal: current.signal });
      throwIfCancelled(current.signal);
      acceptSession(response); notifySessionChange();
      return response;
    } catch (requestError) {
      if (!isRequestCancelled(requestError) && requestRef.current === current) {
        setError(requestError instanceof AuthApiError ? requestError.message : vi.auth.errors.loginUnexpected);
      }
      throw requestError;
    } finally {
      if (!current.signal.aborted && requestRef.current === current) setIsSubmitting(false);
    }
  }
  return { error, setError, isSubmitting, submitLogin };
}
