/** Internal UI/mock models. These do not grant backend access. */
export type CustomerProfile = {
  readonly id: string;
  readonly email: string;
  readonly role: "CUSTOMER";
  fullName: string;
  phone: string | null;
};

export type CustomerProfileDraft = { fullName: string; phone: string };
export type CustomerProfileErrors = Partial<Record<keyof CustomerProfileDraft, string>>;
export type CustomerProfileUpdate = { fullName: string; phone?: string };
