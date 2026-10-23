/** Internal frontend mock models; not an API or authorization contract. */
export type ProfileValues = {
  name: string;
  description: string;
  area: string;
  phone: string;
  email: string;
};

export type ProviderProfile = ProfileValues & {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly category: string;
  readonly approvalStatus: "approved";
};

export type ProfileSection = "all" | "facility" | "contact" | "images";
export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;

export type ProfileImageSlot = "logo" | "cover";
export type ProfileImage = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
};
export type ProfileImages = Record<ProfileImageSlot, ProfileImage | null>;
export type ProfileImageErrors = Partial<Record<ProfileImageSlot, string>>;
export type ProfileEditor = {
  section: ProfileSection;
  draft: ProfileValues;
  images: ProfileImages;
  errors: ProfileErrors;
  imageErrors: ProfileImageErrors;
  decoding: Record<ProfileImageSlot, boolean>;
  saveError: string | null;
};
