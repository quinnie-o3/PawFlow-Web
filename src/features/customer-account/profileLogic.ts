import type { CustomerProfile, CustomerProfileDraft, CustomerProfileErrors, CustomerProfileUpdate } from "./types";

export function profileToDraft(profile: CustomerProfile): CustomerProfileDraft {
  return { fullName: profile.fullName, phone: profile.phone ?? "" };
}

export function prepareProfileUpdate(draft: CustomerProfileDraft): CustomerProfileUpdate {
  // PATCH /users/me trims phone and omits a blank string. Blank does not clear it.
  return { fullName: draft.fullName.trim(), phone: draft.phone.trim() || undefined };
}

export function validateProfileDraft(draft: CustomerProfileDraft): CustomerProfileErrors {
  const values = prepareProfileUpdate(draft);
  const errors: CustomerProfileErrors = {};
  if (values.fullName.length < 2 || values.fullName.length > 150) {
    errors.fullName = "Họ và tên cần từ 2 đến 150 ký tự sau khi bỏ khoảng trắng đầu và cuối.";
  }
  if (values.phone && values.phone.length > 20) {
    errors.phone = "Số điện thoại tối đa 20 ký tự.";
  }
  return errors;
}

export function applyProfileUpdate(profile: CustomerProfile, actorId: string, update: CustomerProfileUpdate): CustomerProfile {
  if (profile.role !== "CUSTOMER" || profile.id !== actorId) {
    throw new Error("Tài khoản mô phỏng không có quyền sửa hồ sơ này.");
  }
  // Explicit allowlist: never spread submitted fields over identity/email/role.
  return {
    ...profile,
    fullName: update.fullName,
    phone: update.phone === undefined ? profile.phone : update.phone,
  };
}
