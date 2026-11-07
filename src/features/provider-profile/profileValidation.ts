import { vi } from "../../lib/locale";
import { profileFields } from "./profileLogic";
import type { ProfileErrors, ProfileSection, ProfileValues } from "./types";

export const profileFieldLimits = { name: 100, description: 2000, area: 200, email: 254 } as const;

export function normalizeProfileValues(values: ProfileValues): ProfileValues {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    area: values.area.trim(),
    phone: values.phone.trim().replace(/[\s-]/g, ""),
    email: values.email.trim(),
  };
}

/** emailFormatValid comes from the same native type=email constraint as auth. */
export function validateProfileValues(values: ProfileValues, section: ProfileSection, emailFormatValid: boolean): ProfileErrors {
  const clean = normalizeProfileValues(values);
  const errors: ProfileErrors = {};
  const fields = profileFields(section);
  if (fields.includes("name") && (clean.name.length < 2 || clean.name.length > profileFieldLimits.name)) errors.name = vi.provider.profile.validation.name;
  if (fields.includes("description") && clean.description.length > profileFieldLimits.description) errors.description = vi.provider.profile.validation.description;
  if (fields.includes("area") && (!clean.area || clean.area.length > profileFieldLimits.area)) errors.area = vi.provider.profile.validation.area;
  if (fields.includes("phone") && !/^(?:0|\+84)\d{9}$/.test(clean.phone)) errors.phone = vi.provider.profile.validation.phone;
  if (fields.includes("email") && (!clean.email || clean.email.length > profileFieldLimits.email || !emailFormatValid)) errors.email = vi.provider.profile.validation.email;
  return errors;
}
