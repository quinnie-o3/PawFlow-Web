"use client";
import { saveAccessToken } from "../services/authToken";
import { registerCustomer, type RegisterCustomerPayload } from "../services/registerCustomer";
import type { RegisterResult } from "../types";
import { useAuthSubmission } from "./useAuthSubmission";

export function useRegisterCustomer() {
  const request = useAuthSubmission<RegisterResult>();
  function submitRegistration(payload: RegisterCustomerPayload) {
    return request.submit(async (signal) => {
      const response = await registerCustomer(payload, signal);
      if (!response.accessToken || signal.aborted) return { authenticated: false };
      try {
        saveAccessToken(response.accessToken);
        return { authenticated: true };
      } catch {
        // The account was created. Ask for login instead of repeating a successful registration.
        return { authenticated: false };
      }
    });
  }
  return { ...request, error: request.requestError?.message, submitRegistration };
}
