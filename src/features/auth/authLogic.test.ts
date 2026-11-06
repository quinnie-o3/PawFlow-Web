import assert from "node:assert/strict";
import { test } from "node:test";
import { vi } from "../../lib/locale";
import { authMockConfig, authUiPolicy } from "./config";
import { validateLogin, validateRegistration } from "./validation";
import { describeAuthError, readAccessToken } from "./services/authError";
import { createMockRecoveryAdapter, getMockResetTokenState } from "./recovery/mockAdapter";
import { MockRecoveryError, type MockRecoveryCode } from "./recovery/types";

const valid = { fullName: "  Khách thử  ", email: " example@example.com ", phone: "", password: " password ", confirmPassword: " password " };
const signal = () => new AbortController().signal;
const code = (expected: MockRecoveryCode) => (error: unknown) => error instanceof MockRecoveryError && error.code === expected;

test("registration accepts optional/blank phone and does not trim the password", () => {
  assert.deepEqual(validateRegistration(valid), {});
  assert.equal(validateRegistration({ ...valid, confirmPassword: valid.password.trim() }).confirmPassword, vi.auth.register.passwordMismatch);
});
test("trimmed names and optional phone respect DTO boundaries", () => {
  assert.ok(validateRegistration({ ...valid, fullName: " a " }).fullName);
  assert.ok(validateRegistration({ ...valid, fullName: "x".repeat(151) }).fullName);
  assert.equal(validateRegistration({ ...valid, fullName: "🐶".repeat(150) }).fullName, undefined);
  assert.equal(validateRegistration({ ...valid, phone: " " + "x".repeat(20) + " " }).phone, undefined);
  assert.ok(validateRegistration({ ...valid, phone: "x".repeat(21) }).phone);
});
test("email and password length/format errors are field-specific", () => {
  for (const email of ["", "not-an-email", "x".repeat(250) + "@a.com"]) assert.ok(validateLogin({ email, password: valid.password }).email);
  for (const count of [0, 7, 73]) assert.ok(validateLogin({ email: valid.email, password: "x".repeat(count) }).password);
  for (const count of [8, 72]) assert.deepEqual(validateLogin({ email: valid.email, password: "x".repeat(count) }), {});
});
test("validation array is normalized and associated with real DTO field names", () => {
  const error = describeAuthError({ message: ["fullName is too short", "password is too short", 7] }, 400);
  assert.equal(error.message, "fullName is too short\npassword is too short");
  assert.equal(error.fieldErrors.password, "password is too short");
  assert.equal(error.fieldErrors.fullName, "fullName is too short");
});
test("only exact current BE messages map account/credential states", () => {
  assert.equal(describeAuthError({ message: "Invalid email or password" }, 401).message, vi.auth.feedback.invalidCredentials);
  assert.equal(describeAuthError({ message: "Account is not active" }, 401).message, vi.auth.feedback.accountNotActive);
  assert.equal(describeAuthError({ message: "Unauthorized" }, 401).message, "Unauthorized");
  assert.equal(describeAuthError({}, 403).message, vi.auth.feedback.forbidden);
  assert.notEqual(describeAuthError({}, 401).message, vi.auth.feedback.accountNotActive);
});
test("email conflict has field feedback; 429 does not invent a cooldown", () => {
  const error = describeAuthError({ message: "Email is already registered" }, 409);
  assert.equal(error.fieldErrors.email, vi.auth.feedback.emailConflict);
  assert.equal(describeAuthError({}, 429).message, vi.auth.feedback.tooManyRequests);
  assert.equal(describeAuthError({ message: "internal details" }, 500).message, vi.auth.feedback.serverError);
});
test("only nonempty string access tokens can enter the real token-save path", () => {
  for (const body of [null, {}, { accessToken: 12 }, { accessToken: " " }]) assert.equal(readAccessToken(body), undefined);
  assert.equal(readAccessToken({ accessToken: "server-response-value" }), "server-response-value");
});
test("verification presentation defaults off independently of mock demo values", () => {
  assert.equal(authUiPolicy.verificationRequired, false);
  assert.equal(authMockConfig.verificationCode.length, 6);
});
test("mock reset URL handles missing, malformed, duplicate, expired and used tokens", () => {
  assert.equal(getMockResetTokenState([]), "missing");
  assert.equal(getMockResetTokenState([""]), "missing");
  assert.equal(getMockResetTokenState(["unknown"]), "invalid");
  assert.equal(getMockResetTokenState([authMockConfig.resetToken, "other"]), "invalid");
  assert.equal(getMockResetTokenState([authMockConfig.expiredResetToken]), "expired");
  assert.equal(getMockResetTokenState([authMockConfig.usedResetToken]), "used");
  assert.equal(getMockResetTokenState([authMockConfig.resetToken]), "valid");
});
test("mock failure preserves the current verification code for retry", async () => {
  const adapter = createMockRecoveryAdapter(() => 100, 0);
  await assert.rejects(adapter.verify(authMockConfig.verificationCode, signal(), true), code("failure"));
  await adapter.verify(authMockConfig.verificationCode, signal());
  await assert.rejects(adapter.verify(authMockConfig.verificationCode, signal()), code("used_code"));
});
test("mock expiry is checked at confirmation and resend cooldown is explicit demo policy", async () => {
  let now = 100;
  const adapter = createMockRecoveryAdapter(() => now, 0);
  await assert.rejects(adapter.verify("999999", signal()), code("invalid_code"));
  now = adapter.verificationTiming().expiresAt;
  await assert.rejects(adapter.verify(authMockConfig.verificationCode, signal()), code("expired_code"));
  await adapter.resend(signal());
  await assert.rejects(adapter.resend(signal()), code("cooldown"));
  now = adapter.verificationTiming().resendAt;
  await adapter.resend(signal());
});
test("failed mock reset does not consume its demo token; successful replay is refused", async () => {
  const adapter = createMockRecoveryAdapter(Date.now, 0);
  await assert.rejects(adapter.reset(authMockConfig.resetToken, "example password", signal(), true), code("failure"));
  await adapter.reset(authMockConfig.resetToken, "example password", signal());
  await assert.rejects(adapter.reset(authMockConfig.resetToken, "example password", signal()), code("used_token"));
});
test("aborted verification does not consume mock state", async () => {
  const adapter = createMockRecoveryAdapter(Date.now, 5);
  const controller = new AbortController();
  const pending = adapter.verify(authMockConfig.verificationCode, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  await adapter.verify(authMockConfig.verificationCode, signal());
});
test("all mock operations succeed without any network or browser storage capability", async () => {
  const previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Network must not be used"); };
  try {
    const adapter = createMockRecoveryAdapter(Date.now, 0);
    await adapter.forgot("demo@example.com", signal());
    await adapter.resend(signal());
    await adapter.verify(authMockConfig.verificationCode, signal());
    await adapter.reset(authMockConfig.resetToken, "example password", signal());
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previous; }
});
