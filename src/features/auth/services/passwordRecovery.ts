import { postAuthJson, type PostAuthJsonOptions } from "./authApi";

/**
 * Password recovery services (backend P3 account recovery).
 * NOTE: the frontend has no forgot/reset-password pages yet; these services are the
 * integration point those pages must use (see docs/P3-FE-turnstile.md).
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
export const FORGOT_PASSWORD_GENERIC_MESSAGE =
  "Nếu email này thuộc một tài khoản đang hoạt động, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.";

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
