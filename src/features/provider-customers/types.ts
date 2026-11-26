import type {
  ProviderBooking,
  ProviderBookingCustomer,
  ProviderBookingSlot,
  ProviderBookingStatus,
} from "../provider-workspace/liveApi";

export type ReportingRange = Readonly<{
  start: string;
  end: string;
}>;

export type CustomersPeriodMode = "range" | "all-time";

export type CustomerPeriodPreset = "30d" | "90d" | "thisMonth" | "allTime";

export type CustomerGroup =
  | "returning"
  | "new"
  | "outsidePeriod"
  | "noCompleted";

export type CustomerFilters = Readonly<{
  query: string;
  group: "all" | "returning" | "new";
}>;

export type CustomerPetProfile = Readonly<{
  id: string;
  name: string;
  petTypeName: string;
  breed: string | null;
  birthDate: string | null;
  weight: string | null;
  healthNote: string | null;
}>;

export type CustomerStatusCounts = Readonly<
  Record<ProviderBookingStatus, number> & { total: number }
>;

export type CustomerRecord = Readonly<{
  customer: ProviderBookingCustomer;
  pets: readonly CustomerPetProfile[];
  bookings: readonly ProviderBooking[];
  statusCounts: CustomerStatusCounts;
  completedCount: number;
  totalCompletedSpendCents: bigint;
  totalCompletedSpendFormatted: string;
  latestCompletedSlot: ProviderBookingSlot | null;
  nextUpcomingSlot: ProviderBookingSlot | null;
  group: CustomerGroup;
}>;

export type CustomersReport = Readonly<{
  servedCustomers: number;
  returningCustomers: number;
  servedPets: number;
}>;
