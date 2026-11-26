"use client";

import ProviderLifecycleBanner from "@/features/provider-workspace/components/ProviderLifecycleBanner";
import type { ProviderProfileLoadStatus } from "@/features/provider-workspace/useProviderProfile";
import type { ProviderApiErrorInfo, ProviderProfile } from "../types";

export default function ProfileApproval({
  status,
  profile,
  error,
  refreshError,
  reloading,
  cooldownSeconds,
  onReload,
}: {
  status: ProviderProfileLoadStatus;
  profile: ProviderProfile | null;
  error?: ProviderApiErrorInfo | null;
  refreshError?: ProviderApiErrorInfo | null;
  reloading?: boolean;
  cooldownSeconds?: number;
  onReload?: () => void;
}) {
  return (
    <ProviderLifecycleBanner
      status={status}
      profile={profile}
      error={error}
      refreshError={refreshError}
      reloading={reloading}
      cooldownSeconds={cooldownSeconds}
      onReload={onReload}
    />
  );
}
