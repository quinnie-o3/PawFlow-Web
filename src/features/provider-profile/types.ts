import type {
  ProviderApiErrorInfo,
  ProviderApprovalStatus,
  ProviderProfile,
  ProviderService,
  UpdateProviderProfileInput,
} from "../provider-workspace/liveApi";

export type {
  ProviderApiErrorInfo,
  ProviderApprovalStatus,
  ProviderProfile,
  UpdateProviderProfileInput,
};

export type ProfileFormValues = Readonly<{
  businessName: string;
  description: string;
  address: string;
  phone: string;
}>;

export type NormalizedProfileDraft = Readonly<{
  businessName: string;
  description: string | null;
  address: string;
  phone: string | null;
}>;

export type ProfileEditSection = "all" | "facility" | "contact";

export type ProfileValidationErrors = Partial<
  Record<keyof ProfileFormValues, string>
>;

export type ProfileOwnerAccount = Readonly<{
  fullName: string;
  email: string;
}>;

export type ProfileUncertainSubmit = Readonly<{
  payload: UpdateProviderProfileInput;
}>;

export type PendingProfileUncertain = Readonly<{
  identity: string;
  section: ProfileEditSection;
  draft: ProfileFormValues;
  uncertain: ProfileUncertainSubmit;
  saveError: ProviderApiErrorInfo | null;
  reconcileNote: string | null;
}>;

export type ProfileEditorState = Readonly<{
  identity: string;
  section: ProfileEditSection;
  draft: ProfileFormValues;
  errors: ProfileValidationErrors;
  saving: boolean;
  reconciling: boolean;
  saveError: ProviderApiErrorInfo | null;
  uncertain: ProfileUncertainSubmit | null;
  reconcileNote: string | null;
}>;

export type ProfileDialogSessionState = Readonly<{
  dialogOpen: boolean;
  editor: ProfileEditorState | null;
  pendingUncertain: PendingProfileUncertain | null;
}>;

export type ProfileReconcileOutcome = "saved" | "suspended" | "not-saved";

export type LiveServicesSummary = Readonly<{
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  categoryNames: readonly string[];
  activeServices: readonly ProviderService[];
}>;

export type LiveWorkingHourGroup = Readonly<{
  key: string;
  label: string;
  hours: string;
  isOpen: boolean;
}>;

export type LiveWorkingHoursSummary = Readonly<{
  openDaysCount: number;
  activeIntervalCount: number;
  groups: readonly LiveWorkingHourGroup[];
}>;
