import { vi } from "../../lib/locale";
import type { AuthFieldErrors } from "./types";

const length = (value: string) => Array.from(value).length;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return vi.auth.validation.emailRequired;
  if (length(value) > 255) return vi.auth.validation.emailLength;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) return vi.auth.validation.emailInvalid;
}

export function validatePassword(password: string): string | undefined {
  if (length(password) < 8 || length(password) > 72) return vi.auth.validation.passwordLength;
}

export function validateLogin(values: { email: string; password: string }): AuthFieldErrors {
  return compactErrors({ email: validateEmail(values.email), password: validatePassword(values.password) });
}

export function validateRegistration(values: {
  fullName: string; email: string; phone: string; password: string; confirmPassword: string;
}): AuthFieldErrors {
  const errors = validateLogin(values);
  const nameLength = length(values.fullName.trim());
  if (nameLength < 2 || nameLength > 150) errors.fullName = vi.auth.validation.nameLength;
  if (length(values.phone.trim()) > 20) errors.phone = vi.auth.validation.phoneLength;
  if (values.password !== values.confirmPassword) errors.confirmPassword = vi.auth.register.passwordMismatch;
  return errors;
}

function compactErrors(errors: AuthFieldErrors): AuthFieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value !== undefined));
}

export function focusFirstAuthError(form: HTMLFormElement, errors: AuthFieldErrors) {
  requestAnimationFrame(() => {
    if (!form.isConnected) return;
    for (const control of Array.from(form.elements)) {
      if (control instanceof HTMLInputElement && errors[control.name as keyof AuthFieldErrors]) {
        control.focus();
        return;
      }
    }
    form.querySelector<HTMLElement>("[data-auth-error]")?.focus();
  });
}
