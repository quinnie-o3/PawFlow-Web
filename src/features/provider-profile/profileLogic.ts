import { formatMessage, vi } from "../../lib/locale";
import {
  normalizeOptionalText,
  type DayOfWeek,
  type ProviderProfile,
  type ProviderService,
  type ProviderWorkingHour,
  type UpdateProviderProfileInput,
} from "../provider-workspace/liveApi";
import { normalizeProfileDraft } from "./profileValidation";
import type {
  LiveServicesSummary,
  LiveWorkingHourGroup,
  LiveWorkingHoursSummary,
  ProfileEditSection,
  ProfileFormValues,
  ProfileReconcileOutcome,
} from "./types";

export const PROFILE_TIME_ZONE = "Asia/Ho_Chi_Minh";

const WEEKDAY_DISPLAY_ORDER: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

const WEEKDAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  0: vi.provider.availability.weekdays.sunday,
  1: vi.provider.availability.weekdays.monday,
  2: vi.provider.availability.weekdays.tuesday,
  3: vi.provider.availability.weekdays.wednesday,
  4: vi.provider.availability.weekdays.thursday,
  5: vi.provider.availability.weekdays.friday,
  6: vi.provider.availability.weekdays.saturday,
};

export function profileToFormValues(
  profile: ProviderProfile,
): ProfileFormValues {
  return {
    businessName: profile.businessName,
    description: profile.description ?? "",
    address: profile.address,
    phone: profile.phone ?? "",
  };
}

export function profileSectionFields(
  section: ProfileEditSection,
): readonly (keyof ProfileFormValues)[] {
  if (section === "facility") return ["businessName", "description"];
  if (section === "contact") return ["address", "phone"];
  return ["businessName", "description", "address", "phone"];
}

/**
 * Explicit allowlist: builds a PATCH /providers/me payload containing only
 * changed editable fields within the active section. Protected metadata
 * (id, ownerId, approvalStatus, ratingAvg, ratingCount, email) is never sent.
 */
export function buildProfileUpdatePatch(
  profile: ProviderProfile,
  draft: ProfileFormValues,
  section: ProfileEditSection,
): UpdateProviderProfileInput {
  const clean = normalizeProfileDraft(draft);
  const baseline = {
    businessName: profile.businessName.trim(),
    description: normalizeOptionalText(profile.description),
    address: profile.address.trim(),
    phone: normalizeOptionalText(profile.phone),
  };

  const fields = profileSectionFields(section);
  const patch: {
    businessName?: string;
    description?: string | null;
    address?: string;
    phone?: string | null;
  } = {};

  if (
    fields.includes("businessName") &&
    clean.businessName !== baseline.businessName
  ) {
    patch.businessName = clean.businessName;
  }
  if (
    fields.includes("description") &&
    clean.description !== baseline.description
  ) {
    patch.description = clean.description;
  }
  if (fields.includes("address") && clean.address !== baseline.address) {
    patch.address = clean.address;
  }
  if (fields.includes("phone") && clean.phone !== baseline.phone) {
    patch.phone = clean.phone;
  }

  return patch;
}

export function hasProfileDraftChanges(
  profile: ProviderProfile,
  draft: ProfileFormValues,
  section: ProfileEditSection,
): boolean {
  return Object.keys(buildProfileUpdatePatch(profile, draft, section)).length > 0;
}

/**
 * Compares an uncertain PATCH /providers/me payload against freshly loaded
 * server state using identical normalization on both sides to prevent false
 * mismatches when reconciling after timeout/network/5xx errors.
 */
export function reconcileProfileUpdate(
  sentPayload: UpdateProviderProfileInput,
  serverProfile: ProviderProfile,
): ProfileReconcileOutcome {
  let matched = true;

  if (sentPayload.businessName !== undefined) {
    if (sentPayload.businessName.trim() !== serverProfile.businessName.trim()) {
      matched = false;
    }
  }
  if (sentPayload.address !== undefined) {
    if (sentPayload.address.trim() !== serverProfile.address.trim()) {
      matched = false;
    }
  }
  if (sentPayload.phone !== undefined) {
    if (
      normalizeOptionalText(sentPayload.phone) !==
      normalizeOptionalText(serverProfile.phone)
    ) {
      matched = false;
    }
  }
  if (sentPayload.description !== undefined) {
    if (
      normalizeOptionalText(sentPayload.description) !==
      normalizeOptionalText(serverProfile.description)
    ) {
      matched = false;
    }
  }

  if (matched) return "saved";
  if (serverProfile.approvalStatus === "SUSPENDED") return "suspended";
  return "not-saved";
}

export function formatProfileTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: PROFILE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

export function formatProfileRating(
  ratingAvg: string,
  ratingCount: number,
): string {
  if (ratingCount <= 0) return vi.provider.profile.information.noRating;
  const numeric = Number(ratingAvg);
  const formattedAvg = Number.isFinite(numeric)
    ? numeric
        .toFixed(2)
        .replace(/\.00$/, ".0")
        .replace(/(\.\d)0$/, "$1")
    : ratingAvg;
  return formatMessage(vi.provider.profile.information.ratingValue, {
    avg: formattedAvg,
    count: ratingCount,
  });
}

export function formatCompactTime(time: string): string {
  return time.endsWith(":00") && time.length === 8 ? time.slice(0, 5) : time;
}

export function summarizeLiveServices(
  services: readonly ProviderService[],
): LiveServicesSummary {
  const activeServices: ProviderService[] = [];
  let inactiveCount = 0;
  const categories = new Set<string>();

  for (const service of services) {
    if (service.status === "ACTIVE") {
      activeServices.push(service);
    } else {
      inactiveCount++;
    }
    const categoryName = service.category?.name.trim();
    if (categoryName) {
      categories.add(categoryName);
    }
  }

  return {
    totalCount: services.length,
    activeCount: activeServices.length,
    inactiveCount,
    categoryNames: Array.from(categories),
    activeServices,
  };
}

export function summarizeLiveWorkingHours(
  hours: readonly ProviderWorkingHour[],
): LiveWorkingHoursSummary {
  const activeByDay = new Map<DayOfWeek, ProviderWorkingHour[]>();
  let activeIntervalCount = 0;

  for (const entry of hours) {
    if (!entry.isActive) continue;
    activeIntervalCount++;
    const list = activeByDay.get(entry.dayOfWeek) ?? [];
    list.push(entry);
    activeByDay.set(entry.dayOfWeek, list);
  }

  const openDaysCount = activeByDay.size;

  const grouped: Array<{
    firstDay: DayOfWeek;
    lastDay: DayOfWeek;
    hours: string;
    isOpen: boolean;
  }> = [];

  for (const day of WEEKDAY_DISPLAY_ORDER) {
    const entries = activeByDay.get(day) ?? [];
    const sorted = [...entries].sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) ||
        a.endTime.localeCompare(b.endTime),
    );
    const isOpen = sorted.length > 0;
    const formatted = isOpen
      ? sorted
          .map(
            (item) =>
              `${formatCompactTime(item.startTime)}–${formatCompactTime(item.endTime)}`,
          )
          .join(" · ")
      : vi.provider.profile.modules.hoursClosed;

    const previous = grouped.at(-1);
    if (previous && previous.hours === formatted && previous.isOpen === isOpen) {
      previous.lastDay = day;
    } else {
      grouped.push({ firstDay: day, lastDay: day, hours: formatted, isOpen });
    }
  }

  const groups: LiveWorkingHourGroup[] = grouped.map((group) => {
    const firstLabel = WEEKDAY_LABELS[group.firstDay];
    const lastLabel = WEEKDAY_LABELS[group.lastDay];
    return {
      key: `${group.firstDay}-${group.lastDay}`,
      label:
        group.firstDay === group.lastDay
          ? firstLabel
          : `${firstLabel} – ${lastLabel}`,
      hours: group.hours,
      isOpen: group.isOpen,
    };
  });

  return {
    openDaysCount,
    activeIntervalCount,
    groups,
  };
}
