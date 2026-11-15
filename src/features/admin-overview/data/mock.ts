import { vi } from "../../../lib/locale";
// Titles and queue destinations from the seven main Admin screens.
// No KPI values or chart series until their definitions are confirmed.
export const overviewMetricLabels = [vi.admin.labels.approvedFacilities, vi.admin.labels.users, vi.admin.labels.bookingsInPeriod, vi.admin.labels.visibleServices, vi.admin.labels.averageRating, vi.admin.labels.openComplaints] as const;

export const adminQueueLinks = [
  { href: "/admin/providers", label: vi.admin.labels.pendingFacilities },
  { href: "/admin/complaints", label: vi.admin.labels.unresolvedComplaints },
  { href: "/admin/reviews", label: vi.admin.labels.reportedReviews },
] as const;
