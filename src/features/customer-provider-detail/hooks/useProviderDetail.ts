"use client";

import { useCallback, useState } from "react";
import { useMockResource } from "../../customer-catalog/hooks/useMockResource";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";

export function useProviderDetail(providerId: string) {
  const { delayMs, faults, clearFault, repository: mockRepository } = useCatalogWorkspace();
  const [detailRetry, setDetailRetry] = useState(0); const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const failDetail = faults.detail; const failAvailability = faults.availability;
  const detailLoader = useCallback((signal: AbortSignal) => mockRepository.detail(providerId, { signal, delayMs, fail: failDetail }), [providerId, delayMs, failDetail, mockRepository]);
  const availabilityLoader = useCallback((signal: AbortSignal) => mockRepository.availability(providerId, { signal, delayMs, fail: failAvailability }), [providerId, delayMs, failAvailability, mockRepository]);
  const detail = useMockResource(JSON.stringify([providerId, delayMs, failDetail, detailRetry]), detailLoader);
  const availability = useMockResource(JSON.stringify([providerId, delayMs, failAvailability, availabilityRetry]), availabilityLoader);
  return { detail, availability, retryDetail: () => { clearFault("detail"); setDetailRetry(n => n + 1); }, retryAvailability: () => { clearFault("availability"); setAvailabilityRetry(n => n + 1); } };
}
