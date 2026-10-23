import type { ProfileSection, ProfileValues, ProviderProfile } from "./types";

export function getProfileValues(profile: ProfileValues): ProfileValues {
  return { name: profile.name, description: profile.description, area: profile.area, phone: profile.phone, email: profile.email };
}

export function profileFields(section: ProfileSection): (keyof ProfileValues)[] {
  if (section === "images") return [];
  if (section === "facility") return ["name", "description"];
  if (section === "contact") return ["area", "phone", "email"];
  return ["name", "description", "area", "phone", "email"];
}

export function canEditProfileImages(section: ProfileSection) {
  return section === "all" || section === "images";
}

/** Explicit allowlist: protected metadata is never accepted from form values. */
export function applyProfileValues(profile: ProviderProfile, values: ProfileValues, section: ProfileSection): ProviderProfile {
  const next = { ...profile };
  for (const field of profileFields(section)) next[field] = values[field];
  return next;
}
