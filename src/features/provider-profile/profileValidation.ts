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
  if (fields.includes("name") && (clean.name.length < 2 || clean.name.length > profileFieldLimits.name)) errors.name = "Tên cơ sở phải có từ 2 đến 100 ký tự sau khi bỏ khoảng trắng đầu/cuối.";
  if (fields.includes("description") && clean.description.length > profileFieldLimits.description) errors.description = "Mô tả tối đa 2.000 ký tự.";
  if (fields.includes("area") && (!clean.area || clean.area.length > profileFieldLimits.area)) errors.area = "Khu vực bắt buộc và tối đa 200 ký tự.";
  if (fields.includes("phone") && !/^(?:0|\+84)\d{9}$/.test(clean.phone)) errors.phone = "Nhập 0 hoặc +84 rồi 9 chữ số. Có thể dùng khoảng trắng và dấu gạch.";
  if (fields.includes("email") && (!clean.email || clean.email.length > profileFieldLimits.email || !emailFormatValid)) errors.email = "Nhập email liên hệ hợp lệ, tối đa 254 ký tự.";
  return errors;
}
