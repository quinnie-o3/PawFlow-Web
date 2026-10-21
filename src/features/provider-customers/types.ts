import type { BookingStatus } from "../provider-bookings/types";

/** Internal mock models, not an API contract. */
export type Customer = { id: string; name: string; phone: string; email: string };
export type CustomerPet = { id: string; customerId: string; name: string; species: string; breed: string };
export type CustomerBooking = {
  id: string;
  facilityId: string;
  customerId: string;
  petId: string;
  serviceName: string;
  scheduledAt: string;
  status: BookingStatus;
};
export type CustomersMockData = { customers: Customer[]; pets: CustomerPet[]; bookings: CustomerBooking[] };
export type ReportingRange = { start: string; end: string };
export type CustomerGroup = "returning" | "new" | "outsidePeriod" | "noCompleted";
export type CustomerFilters = { query: string; group: "all" | "returning" | "new" };
export type CustomerRecord = {
  customer: Customer;
  pets: CustomerPet[];
  bookings: CustomerBooking[];
  completedCount: number;
  lastServedAt: string | null;
  group: CustomerGroup;
};
export type CustomersReport = { servedCustomers: number; returningCustomers: number; servedPets: number };
