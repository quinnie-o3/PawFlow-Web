import type {
  ProviderApiErrorInfo,
  ProviderService,
  ProviderServiceCategoryRef,
  ProviderServiceStatus,
  ServiceCategoryOption,
} from "../provider-workspace/liveApi";

export type {
  ProviderApiErrorInfo,
  ProviderService,
  ProviderServiceCategoryRef,
  ProviderServiceStatus,
  ServiceCategoryOption,
};

export type ServiceStatusFilter = "ALL" | ProviderServiceStatus;

export type ServiceFilters = Readonly<{
  query: string;
  status: ServiceStatusFilter;
  /** Empty string selects all categories. */
  categoryId: string;
}>;

export type ServiceDraft = Readonly<{
  categoryId: string;
  name: string;
  price: string;
  durationMinutes: string;
  description: string;
}>;

export type ServiceFieldKey = keyof ServiceDraft;

export type ServiceValidationErrors = Partial<Record<ServiceFieldKey, string>>;

export type ServiceCategoryFilterOption = Readonly<{
  id: string;
  name: string;
  inactive: boolean;
}>;

export type ExpectedCreateServicePayload = Readonly<{
  categoryId: string;
  name: string;
  canonicalPrice: string;
  durationMinutes: number;
  description: string | null;
}>;

export type ExpectedUpdateServicePatch = Readonly<{
  categoryId?: string;
  name?: string;
  canonicalPrice?: string;
  durationMinutes?: number;
  description?: string | null;
  status?: ProviderServiceStatus;
}>;

export type ServiceUncertainState =
  | Readonly<{
      kind: "create";
      preSubmitIds: readonly string[];
      expected: ExpectedCreateServicePayload;
    }>
  | Readonly<{
      kind: "update";
      serviceId: string;
      expected: ExpectedUpdateServicePatch;
    }>
  | Readonly<{
      kind: "status";
      serviceId: string;
      targetStatus: ProviderServiceStatus;
    }>;

export type ServiceEditorState = Readonly<{
  identity: string;
  mode: "create" | "edit";
  serviceId: string | null;
  draft: ServiceDraft;
  errors: ServiceValidationErrors;
  saving: boolean;
  updatingStatus: boolean;
  reconciling: boolean;
  confirmStatus: ProviderServiceStatus | null;
  saveError: ProviderApiErrorInfo | null;
  statusError: ProviderApiErrorInfo | null;
  uncertain: ServiceUncertainState | null;
  reconcileNote: string | null;
  statusFeedback: string | null;
}>;

export type ServiceFeedback = Readonly<{
  outcome: "success" | "error";
  message: string;
}>;
