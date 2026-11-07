import { authMockConfig as config } from "../config";
import { MockRecoveryError, type AuthRecoveryAdapter } from "./types";

export function getMockResetTokenState(tokens: readonly string[]) {
  if (tokens.length === 0 || (tokens.length === 1 && !tokens[0])) return "missing";
  if (tokens.length !== 1) return "invalid";
  if (tokens[0] === config.expiredResetToken) return "expired";
  if (tokens[0] === config.usedResetToken) return "used";
  return tokens[0] === config.resetToken ? "valid" : "invalid";
}

function delay(signal: AbortSignal, milliseconds: number) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const onAbort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** In-memory demonstration only: never fetches, stores passwords/tokens or changes real Auth. */
export function createMockRecoveryAdapter(now: () => number = Date.now, latency: number = config.delayMs): AuthRecoveryAdapter {
  let expiresAt = now() + config.verificationLifetimeMs;
  let resendAt = 0;
  let verified = false;
  let resetUsed = false;
  async function wait(signal: AbortSignal, fail = false) {
    await delay(signal, latency);
    if (fail) throw new MockRecoveryError("failure");
  }
  return {
    mode: "mock",
    async forgot(_email, signal, fail) { await wait(signal, fail); },
    async reset(token, _password, signal, fail) {
      await wait(signal, fail);
      const state = getMockResetTokenState([token]);
      if (state !== "valid") throw new MockRecoveryError(state === "expired" ? "expired_token" : state === "used" ? "used_token" : "invalid_token");
      if (resetUsed) throw new MockRecoveryError("used_token");
      resetUsed = true;
    },
    async verify(code, signal, fail) {
      await wait(signal, fail);
      if (verified) throw new MockRecoveryError("used_code");
      if (now() >= expiresAt) throw new MockRecoveryError("expired_code");
      if (code !== config.verificationCode) throw new MockRecoveryError("invalid_code");
      verified = true;
    },
    async resend(signal, fail) {
      await wait(signal, fail);
      if (verified) throw new MockRecoveryError("used_code");
      if (now() < resendAt) throw new MockRecoveryError("cooldown");
      expiresAt = now() + config.verificationLifetimeMs;
      resendAt = now() + config.resendCooldownMs;
    },
    verificationTiming: () => ({ expiresAt, resendAt }),
  };
}
