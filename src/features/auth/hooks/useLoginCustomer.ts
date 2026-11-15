"use client";

import { vi } from "@/lib/locale";

import { useState } from "react";
import { AuthApiError } from "../services/authApi";
import { saveAccessToken } from "../services/authToken";
import { loginCustomer, type LoginCustomerPayload } from "../services/loginCustomer";

export function useLoginCustomer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLogin(payload: LoginCustomerPayload) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await loginCustomer(payload);
      saveAccessToken(response.accessToken);
    } catch (requestError) {
      setError(requestError instanceof AuthApiError ? requestError.message : vi.auth.errors.loginUnexpected);
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, setError, isSubmitting, submitLogin };
}
