import type { ProviderProfile } from "../types";

/** Figma sample only. Each mount starts a fresh in-memory profile. */
export function createProviderProfileMock(): ProviderProfile {
  return {
    id: "MOCK-PAWCARE",
    ownerId: "owner-demo",
    ownerName: "Dane Nguyen",
    category: "Dịch vụ chăm sóc thú cưng",
    approvalStatus: "approved",
    name: "PawCare Studio",
    description: "Chăm sóc theo lịch hẹn",
    area: "Quận 3, TP. Hồ Chí Minh",
    phone: "0900000002",
    email: "contact@pawcare.example",
  };
}
