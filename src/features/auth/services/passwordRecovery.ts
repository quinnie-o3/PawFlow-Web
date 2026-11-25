import { vi } from "../../../lib/locale";
import { postAuthJson, type PostAuthJsonOptions } from "./authApi";

/**
 * Password recovery services (backend P3 account recovery).
 * Recovery pages use these operations through the fixed same-origin recovery proxy.
 */

/** Body of `POST /auth/forgot-password` (backend `ForgotPasswordDto`). */
export type ForgotPasswordPayload = {
  email: string;
  /** Fresh token from a widget rendered with action `forgot_password`. */
  turnstileToken: string;
};

/** Body of `POST /auth/reset-password` (backend `ResetPasswordDto`). */
export type ResetPasswordPayload = {
  /** Password-reset token from the e-mailed link (`/reset-password#token=…`). Not the Turnstile token. */
  token: string;
  newPassword: string;
  /** Fresh token from a widget rendered with action `reset_password`. */
  turnstileToken: string;
};

/**
 * Generic, account-agnostic confirmation. The backend returns an identical 202 body for every
 * address; the UI must show this same text whatever the e-mail, so accounts cannot be enumerated.
 */
export const FORGOT_PASSWORD_GENERIC_MESSAGE = vi.auth.forgotPassword.genericSent;

export async function requestPasswordReset(payload: ForgotPasswordPayload, options: PostAuthJsonOptions = {}): Promise<{ message: string }> {
  await postAuthJson("forgotPassword", { email: payload.email, turnstileToken: payload.turnstileToken }, options);
  return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
}

export async function resetPassword(payload: ResetPasswordPayload, options: PostAuthJsonOptions = {}): Promise<void> {
  await postAuthJson(
    "resetPassword",
    { token: payload.token, newPassword: payload.newPassword, turnstileToken: payload.turnstileToken },
    options,
  );
}
