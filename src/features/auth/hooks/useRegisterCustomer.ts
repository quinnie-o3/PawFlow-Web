"use client";

import { useState } from "react";
import { RegisterCustomerError, registerCustomer, type RegisterCustomerPayload } from "../services/registerCustomer";

export function useRegisterCustomer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRegistration(payload: RegisterCustomerPayload) {
    setIsSubmitting(true);
    setError(null);

    try {
      await registerCustomer(payload);
    } catch (requestError) {
      setError(requestError instanceof RegisterCustomerError ? requestError.message : "Đã xảy ra lỗi khi đăng ký tài khoản.");
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, submitRegistration };
}
