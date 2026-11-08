import Image from "next/image";

const assets = {
  logo: ["logo.svg", 60, 60],
  wordmark: ["wordmark.svg", 115.5, 28.2272],
  calendar: ["calendar.svg", 20, 20],
  identity: ["identity-arrow.svg", 18, 18],
  account: ["nav-account.svg", 24, 24],
  bookings: ["nav-bookings.svg", 24, 24],
  notifications: ["nav-notifications.svg", 24, 24],
  accountActive: ["tab-account-active.svg", 20.0198, 20],
  accountInactive: ["tab-account-inactive.svg", 20.0198, 20],
  petsActive: ["tab-pets-active.svg", 20, 20],
  petsInactive: ["tab-pets-inactive.svg", 20, 20],
} as const;

/** Render downloaded Figma SVGs at their original root dimensions. */
export default function CustomerAsset({ name }: { name: keyof typeof assets }) {
  const [file, width, height] = assets[name];
  return <Image aria-hidden="true" alt="" src={"/customer-account/" + file}
    width={Math.ceil(width)} height={Math.ceil(height)} style={{ width, height, flexShrink: 0 }} />;
}
