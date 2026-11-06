"use client";
import { vi } from "@/lib/locale";
import { saveAccessToken } from "../services/authToken";
import { AuthRequestError } from "../services/authError";
import { loginCustomer, type LoginCustomerPayload } from "../services/loginCustomer";
import { useAuthSubmission } from "./useAuthSubmission";

export function useLoginCustomer() {
  const request = useAuthSubmission<{ authenticated: true }>();
  function submitLogin(payload: LoginCustomerPayload) {
    return request.submit(async (signal) => {
      const response = await loginCustomer(payload, signal);
      if (signal.aborted) return { authenticated: true };
      try { saveAccessToken(response.accessToken); }
      catch { throw new AuthRequestError(vi.auth.feedback.storageError); }
      return { authenticated: true };
    });
  }
  return { ...request, error: request.requestError?.message, submitLogin };
}
