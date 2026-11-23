"use client";

import { vi } from "@/lib/locale";
import { useEffect, useRef, useState } from "react";
import { isRequestCancelled, throwIfCancelled } from "../../../lib/api/errors";
import { AuthApiError } from "../services/authApi";
import { registerCustomer, type RegisterCustomerPayload } from "../services/registerCustomer";

export function useRegisterCustomer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function submitRegistration(payload: RegisterCustomerPayload) {
    requestRef.current?.abort();
    const current = new AbortController();
    requestRef.current = current;
    setIsSubmitting(true);
    setError(null);
    try {
      await registerCustomer(payload, { signal: current.signal });
      throwIfCancelled(current.signal);
    } catch (requestError) {
      if (!isRequestCancelled(requestError) && requestRef.current === current) {
        setError(requestError instanceof AuthApiError ? requestError.message : vi.auth.errors.registerUnexpected);
      }
      throw requestError;
    } finally {
      if (!current.signal.aborted && requestRef.current === current) setIsSubmitting(false);
    }
  }
  return { error, setError, isSubmitting, submitRegistration };
}
