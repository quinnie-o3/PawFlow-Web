export type AuthField = "fullName" | "email" | "phone" | "password" | "confirmPassword";
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export type AuthResponse = {
  accessToken?: string;
  tokenType?: string;
};

export type RegisterResult = { authenticated: boolean };
