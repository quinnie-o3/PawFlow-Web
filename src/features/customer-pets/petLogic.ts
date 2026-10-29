import type { CustomerPet, PetActor, PetCommand, PetDraft, PetErrors, PetResult, PetState, PetType, PetValues } from "./types";

export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function petAge(birthDate: string | null, today: string): string {
  if (!birthDate || !validDateOnly(birthDate) || birthDate > today) return "Chưa có ngày sinh";
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const months = (ty - y) * 12 + tm - m - (td < d ? 1 : 0);
  const years = Math.floor(months / 12);
  if (years > 0) return years + " tuổi";
  if (months > 0) return months + " tháng tuổi";
  return "Dưới 1 tháng tuổi";
}

export function petToDraft(pet?: CustomerPet): PetDraft {
  return { name: pet?.name ?? "", petTypeId: pet?.petTypeId ?? "", breed: pet?.breed ?? "",
    birthDate: pet?.birthDate ?? "", weight: pet?.weight?.toString() ?? "", healthNote: pet?.healthNote ?? "" };
}

function weightNumber(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
}

function decimalPlaces(value: number): number {
  const [base, exponent = "0"] = value.toString().toLowerCase().split("e");
  return Math.max(0, (base.split(".")[1]?.length ?? 0) - Number(exponent));
}

export function validatePetDraft(draft: PetDraft, types: PetType[], today: string, previousTypeId?: string): PetErrors {
  const errors: PetErrors = {};
  const name = draft.name.trim();
  if (!name || [...name].length > 100) errors.name = "Tên thú cưng cần từ 1 đến 100 ký tự sau khi bỏ khoảng trắng đầu và cuối.";
  const type = types.find((item) => item.id === draft.petTypeId);
  // The current API permits retaining an existing inactive type while editing other fields.
  if (!type || (type.status !== "ACTIVE" && type.id !== previousTypeId)) errors.petTypeId = "Chọn một loài đang được hỗ trợ.";
  if ([...draft.breed.trim()].length > 100) errors.breed = "Giống tối đa 100 ký tự.";
  if (draft.birthDate && (!validDateOnly(draft.birthDate) || draft.birthDate > today)) errors.birthDate = "Chọn ngày sinh hợp lệ, không sau ngày hôm nay.";
  const weight = weightNumber(draft.weight);
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 9999.99 || decimalPlaces(weight) > 2)) {
    errors.weight = "Cân nặng phải lớn hơn 0, tối đa 9999,99 kg và tối đa hai số thập phân.";
  }
  return errors;
}

export function normalizePetDraft(draft: PetDraft): PetValues {
  return { name: draft.name.trim(), petTypeId: draft.petTypeId, breed: draft.breed.trim() || null,
    birthDate: draft.birthDate || null, weight: weightNumber(draft.weight), healthNote: draft.healthNote.trim() || null };
}

export function activeOwnedPets(state: PetState, actor: PetActor): CustomerPet[] {
  if (actor.role !== "CUSTOMER") return [];
  return state.pets.filter((pet) => pet.ownerId === actor.id && pet.status === "ACTIVE");
}

export function applyPetCommand(state: PetState, actor: PetActor, command: PetCommand, today: string, fail = false): PetResult {
  const reject = (message: string, errors?: PetErrors): PetResult => ({ ok: false, state, message, errors });
  if (actor.role !== "CUSTOMER") return reject("Vai trò mô phỏng không được quản lý hồ sơ thú cưng.");
  const existing = state.pets.find((pet) => pet.id === command.id);
  if (command.type === "create") {
    if (existing) return reject("Mã hồ sơ đã tồn tại. Vui lòng mở lại biểu mẫu.");
  } else {
    if (!existing || existing.status !== "ACTIVE") return reject("Hồ sơ không còn trong danh sách đang sử dụng.");
    if (existing.ownerId !== actor.id) return reject("Tài khoản mô phỏng không sở hữu hồ sơ này.");
    if (existing.version !== command.expectedVersion) return reject("Hồ sơ vừa thay đổi. Đóng biểu mẫu và mở lại để lấy dữ liệu mới.");
  }
  if (command.type !== "deactivate") {
    const errors = validatePetDraft(command.draft, state.petTypes, today, existing?.petTypeId);
    if (Object.keys(errors).length) return reject("Kiểm tra lại thông tin thú cưng.", errors);
  }
  if (fail) return reject("Thao tác chưa thành công (lỗi mô phỏng). Dữ liệu đã lưu không đổi; vui lòng thử lại.");
  if (command.type === "deactivate") {
    return { ok: true, id: command.id, state: { ...state, pets: state.pets.map((pet) => pet.id === command.id ? { ...pet, status: "INACTIVE", version: pet.version + 1 } : pet) } };
  }
  const values = normalizePetDraft(command.draft);
  const next: CustomerPet = command.type === "create"
    ? { ...values, id: command.id, ownerId: actor.id, status: "ACTIVE", version: 1, image: command.image }
    : { ...existing!, ...values, image: command.image, version: existing!.version + 1 };
  return { ok: true, id: command.id, state: { ...state, pets: command.type === "create" ? [next, ...state.pets] : state.pets.map((pet) => pet.id === command.id ? next : pet) } };
}
