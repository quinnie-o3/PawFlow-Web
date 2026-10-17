"use client";

import { useState } from "react";
import { saveAccessToken } from "../services/authToken";
import { LoginCustomerError, loginCustomer, type LoginCustomerPayload } from "../services/loginCustomer";

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
      setError(requestError instanceof LoginCustomerError ? requestError.message : "Đã xảy ra lỗi khi đăng nhập.");
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, submitLogin };
}
