/** Presentation policy only. A future API contract must enforce verification on the server. */
export const authUiPolicy = Object.freeze({ verificationRequired: false });

/** Demo values only; these are not backend TTL, retry or password policies. */
export const authMockConfig = Object.freeze({
  delayMs: 500,
  verificationCode: "123456",
  verificationLifetimeMs: 180_000,
  resendCooldownMs: 10_000,
  resetToken: "demo-reset",
  expiredResetToken: "demo-expired",
  usedResetToken: "demo-used",
  passwordMinLength: 8,
  passwordMaxLength: 72,
});
