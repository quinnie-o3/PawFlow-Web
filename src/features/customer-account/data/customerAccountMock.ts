import type { CustomerProfile } from "../types";

/** A fictional Customer, independent of the real login/token and Provider data. */
export function createCustomerAccountMock(): CustomerProfile {
  return {
    id: "customer-demo",
    role: "CUSTOMER",
    fullName: "Nguyễn Mai Anh",
    email: "maianh@example.com",
    phone: "0900 000 000",
  };
}

export const customerMockActorId = "customer-demo";
