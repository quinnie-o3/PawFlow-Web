/** UI seam for a future backend adapter. No endpoint or wire DTO is implied here. */
export interface AuthRecoveryAdapter {
  readonly mode: "mock";
  forgot(email: string, signal: AbortSignal, fail?: boolean): Promise<void>;
  reset(token: string, password: string, signal: AbortSignal, fail?: boolean): Promise<void>;
  verify(code: string, signal: AbortSignal, fail?: boolean): Promise<void>;
  resend(signal: AbortSignal, fail?: boolean): Promise<void>;
  verificationTiming(): { expiresAt: number; resendAt: number };
}

export type MockRecoveryCode = "failure" | "invalid_code" | "expired_code" | "used_code" | "cooldown" | "invalid_token" | "expired_token" | "used_token";
export class MockRecoveryError extends Error {
  constructor(readonly code: MockRecoveryCode) { super(code); this.name = "MockRecoveryError"; }
}
