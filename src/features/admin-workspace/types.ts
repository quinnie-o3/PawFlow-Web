export type AdminTone = "success" | "warning" | "danger" | "info";

/** Display model for read-only Admin fixtures, not a backend contract. */
export interface AdminRecord {
  id: string;
  title: string;
  cells: readonly string[];
  status: { label: string; tone: AdminTone };
  tags: readonly string[];
  date?: string;
  description: string;
  details: readonly { label: string; value: string }[];
  pendingActions?: readonly string[];
}

export interface AdminFilters {
  query: string;
  group: string;
  from: string;
  to: string;
}

export interface AdminCollectionDefinition {
  title: string;
  description: string;
  listTitle: string;
  listDescription: string;
  headers: readonly string[];
  filters: readonly { value: string; label: string }[];
  metricLabels: readonly string[];
  searchLabel: string;
  introAction?: string;
  introActionPending?: boolean;
  introNotes?: readonly string[];
  dateFilter?: boolean;
}
