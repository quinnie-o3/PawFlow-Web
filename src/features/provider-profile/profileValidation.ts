import { vi } from "../../lib/locale";
import { normalizeOptionalText } from "../provider-workspace/liveApi";
import { profileSectionFields } from "./profileLogic";
import type {
  NormalizedProfileDraft,
  ProfileEditSection,
  ProfileFormValues,
  ProfileValidationErrors,
} from "./types";

/**
 * Exact limits from PawFlow-API/src/providers/dto/update-provider.dto.ts:
 * - businessName: trim, MinLength(2), MaxLength(200)
 * - address: trim, MinLength(5), no MaxLength (text)
 * - phone: optional, nullable, MaxLength(20)
 * - description: optional, nullable, no MaxLength (text)
 */
export const profileFieldLimits = {
  businessNameMin: 2,
  businessNameMax: 200,
  addressMin: 5,
  phoneMax: 20,
} as const;

export function normalizeProfileDraft(
  values: ProfileFormValues,
): NormalizedProfileDraft {
  return {
    businessName: values.businessName.trim(),
    description: normalizeOptionalText(values.description),
    address: values.address.trim(),
    phone: normalizeOptionalText(values.phone),
  };
}

export function validateProfileDraft(
  values: ProfileFormValues,
  section: ProfileEditSection,
): ProfileValidationErrors {
  const clean = normalizeProfileDraft(values);
  const errors: ProfileValidationErrors = {};
  const fields = profileSectionFields(section);

  if (
    fields.includes("businessName") &&
    (clean.businessName.length < profileFieldLimits.businessNameMin ||
      clean.businessName.length > profileFieldLimits.businessNameMax)
  ) {
    errors.businessName = vi.provider.profile.validation.businessName;
  }

  if (
    fields.includes("address") &&
    clean.address.length < profileFieldLimits.addressMin
  ) {
    errors.address = vi.provider.profile.validation.address;
  }

  if (
    fields.includes("phone") &&
    clean.phone !== null &&
    clean.phone.length > profileFieldLimits.phoneMax
  ) {
    errors.phone = vi.provider.profile.validation.phone;
  }

  return errors;
}
