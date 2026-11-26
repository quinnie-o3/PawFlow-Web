import type {
  DayOfWeek,
  ProviderApiErrorInfo,
  ProviderApprovalStatus,
  ProviderAvailabilityServiceRef,
  ProviderAvailabilitySlot,
  ProviderService,
  ProviderSlotStatus,
  ProviderWorkingHour,
} from "../provider-workspace/liveApi";

export type AvailabilityLoadStatus = "idle" | "loading" | "ready" | "error";

export type AvailabilityFeedback = Readonly<{
  outcome: "success" | "error";
  message: string;
}>;

export type VietnamSchedulingClock = Readonly<{
  /** Calendar date in Asia/Ho_Chi_Minh (`YYYY-MM-DD`). */
  today: string;
  /** Time of day in seconds since midnight, including fractional milliseconds. */
  secondsOfDay: number;
  /** Whole-minute wall-clock label (`HH:mm`). */
  hhMm: string;
}>;

export type WeeklyDaySchedule = Readonly<{
  dayOfWeek: DayOfWeek;
  label: string;
  active: readonly ProviderWorkingHour[];
  inactive: readonly ProviderWorkingHour[];
}>;

export type AvailabilitySummaryMetrics = Readonly<{
  openSlotsNext7Days: number;
  heldBookingsNext7Days: number;
  activeDaysCount: number;
  activeShiftsCount: number;
}>;

export type SlotStatusFilter = "ALL" | ProviderSlotStatus;

export type WorkingHourDraft = Readonly<{
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}>;

export type WorkingHourFieldKey = "dayOfWeek" | "startTime" | "endTime";

export type WorkingHourValidationErrors = Partial<
  Readonly<Record<WorkingHourFieldKey | "form", string>>
>;

export type ExpectedWorkingHourState = Readonly<{
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}>;

export type WorkingHourUncertainAction =
  | Readonly<{
      kind: "create";
      preSubmitIds: readonly string[];
      expected: Readonly<{
        dayOfWeek: DayOfWeek;
        startTime: string;
        endTime: string;
        isActive: true;
      }>;
    }>
  | Readonly<{
      kind: "update" | "reactivate";
      workingHourId: string;
      expected: ExpectedWorkingHourState;
    }>
  | Readonly<{
      kind: "deactivate";
      workingHourId: string;
    }>;

export type WorkingHoursDialogState = Readonly<{
  identity: string;
  mode: "create" | "edit";
  editingId: string | null;
  draft: WorkingHourDraft;
  errors: WorkingHourValidationErrors;
  saving: boolean;
  mutatingRowId: string | null;
  confirmDeactivateId: string | null;
  reconciling: boolean;
  error: ProviderApiErrorInfo | null;
  uncertain: WorkingHourUncertainAction | null;
  reconcileNote: string | null;
  inlineFeedback: AvailabilityFeedback | null;
}>;

export type SlotDraft = Readonly<{
  serviceId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  capacity: string;
}>;

export type SlotFieldKey =
  | "serviceId"
  | "slotDate"
  | "startTime"
  | "endTime"
  | "capacity";

export type SlotValidationErrors = Partial<
  Readonly<Record<SlotFieldKey | "form", string>>
>;

export type ExpectedSlotState = Readonly<{
  serviceId?: string;
  slotDate?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  status?: ProviderSlotStatus;
}>;

export type SlotStatusAction = "close" | "reopen" | "cancel";

export type SlotUncertainAction =
  | Readonly<{
      kind: "create";
      preSubmitIds: readonly string[];
      expected: Readonly<{
        serviceId: string;
        slotDate: string;
        startTime: string;
        endTime: string;
        capacity: number;
      }>;
    }>
  | Readonly<{
      kind: "update";
      slotId: string;
      expected: ExpectedSlotState;
    }>
  | Readonly<{
      kind: "status";
      slotId: string;
      targetStatus: "OPEN" | "CLOSED";
    }>
  | Readonly<{
      kind: "cancel";
      slotId: string;
    }>;

export type SlotEditorState = Readonly<{
  identity: string;
  mode: "create" | "edit";
  slotId: string | null;
  draft: SlotDraft;
  autoEndTime: boolean;
  errors: SlotValidationErrors;
  saving: boolean;
  updatingStatus: boolean;
  reconciling: boolean;
  confirmAction: SlotStatusAction | null;
  saveError: ProviderApiErrorInfo | null;
  statusError: ProviderApiErrorInfo | null;
  uncertain: SlotUncertainAction | null;
  reconcileNote: string | null;
  statusFeedback: string | null;
}>;

export type ReconcileCreateResult<T> =
  | Readonly<{ outcome: "created"; item: T }>
  | Readonly<{
      outcome: "forbidden-lifecycle";
      approvalStatus: "REJECTED" | "SUSPENDED";
    }>
  | Readonly<{ outcome: "not-created" }>;

export type ReconcileUpdateResult<T> =
  | Readonly<{ outcome: "saved"; item: T }>
  | Readonly<{ outcome: "not-found" }>
  | Readonly<{
      outcome: "forbidden-lifecycle";
      approvalStatus: "REJECTED" | "SUSPENDED";
    }>
  | Readonly<{ outcome: "not-saved" }>;

export type ResolvedSlotService = Readonly<{
  id: string;
  name: string;
  durationMinutes: number;
  status: ProviderService["status"];
  source: "services-list" | "slot-relation";
}>;

export type {
  DayOfWeek,
  ProviderApiErrorInfo,
  ProviderApprovalStatus,
  ProviderAvailabilityServiceRef,
  ProviderAvailabilitySlot,
  ProviderService,
  ProviderSlotStatus,
  ProviderWorkingHour,
};
