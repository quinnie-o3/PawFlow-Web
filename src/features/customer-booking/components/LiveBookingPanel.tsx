"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { ApiError, isRequestCancelled } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import {
  apiMessage,
  bffRequest,
  privateCache,
  retrySession,
  snapshot,
} from "../../session/client";
import { roleHome } from "../../session/model";
import { decodePets } from "../../customer-account/api";
import type { CustomerPet } from "../../customer-pets/types";
import {
  formatDateOnly,
  formatDuration,
  formatPrice,
} from "../../customer-catalog/catalogLogic";
import type { Page, Provider, Service, Slot } from "../../public-catalog/api";
import CustomerDialog from "../../customer-shell/components/CustomerDialog";
import {
  classifyBookingError,
  createBooking,
  createIdempotencyKey,
  getPublicAvailabilitySlot,
  type LiveAvailabilitySlot,
} from "../liveApi";
import {
  activeCustomerActor,
  availableDatesForSlots,
  beginLiveSubmission,
  beginSameKeyRetry,
  createInitialFlow,
  failPreSubmitVerification,
  fromApiErrorInfo,
  isSubmissionInFlight,
  isSubmissionLocked,
  promoteToPendingCreate,
  resetFlowForNewBooking,
  retryCooldownRemainingMs,
  reviewFlow,
  selectFlowField,
  sessionBoundaryAction,
  sessionIdentityKey,
  settleLiveSubmission,
  shouldShowReceiptDialog,
  syncFlowService,
  updateFlowNote,
  validateFreshSlotAgainstQuote,
  type LiveBookingFlow,
  type LiveSessionSnapshot,
} from "../liveSubmission";
import shell from "../../discovery-shell/shell.module.css";
import detailStyles from "../../customer-provider-detail/detail.module.css";
import styles from "../booking.module.css";

export type LiveAvailabilityResourceState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "error"; error: unknown; failedAt: number }
  | { status: "ready"; data: Page<Slot> };

export type LiveBookingPanelProps = {
  provider: Provider;
  selectedService: Service | null;
  serviceLoading: boolean;
  availabilityState: LiveAvailabilityResourceState;
  availabilityRevision: number;
  onRefreshAvailability: () => void;
};

type PetsLoadState = {
  status: "idle" | "loading" | "ready" | "error";
  items: CustomerPet[];
  error: string | null;
};

const EMPTY_PETS: PetsLoadState = { status: "idle", items: [], error: null };

export default function LiveBookingPanel({
  provider,
  selectedService,
  serviceLoading,
  availabilityState,
  availabilityRevision,
  onRefreshAvailability,
}: LiveBookingPanelProps) {
  const session = useSession();
  const t = vi.booking.live;

  const [trackedSession, setTrackedSession] = useState<{
    identity: string | null;
    status: LiveSessionSnapshot["status"];
  }>(() => ({
    identity: sessionIdentityKey(session),
    status: session.status,
  }));

  const [petsState, setPetsState] = useState<PetsLoadState>(EMPTY_PETS);
  const [flow, setFlow] = useState<LiveBookingFlow>(() =>
    createInitialFlow(provider.id, selectedService?.id ?? null),
  );
  const [dateInput, setDateInput] = useState<string | null>(null);
  const [rememberedSlot, setRememberedSlot] = useState<{
    slot: LiveAvailabilitySlot;
    revision: number;
  } | null>(null);
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);
  const [retryErrorMessage, setRetryErrorMessage] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  const flowRef = useRef<LiveBookingFlow>(flow);
  const petsControllerRef = useRef<AbortController | null>(null);
  const petsRevisionRef = useRef(0);
  const submitControllerRef = useRef<AbortController | null>(null);

  const boundary = sessionBoundaryAction(trackedSession.identity, session);
  const sessionChanged =
    trackedSession.identity !== boundary.identity ||
    trackedSession.status !== session.status;

  if (sessionChanged) {
    setTrackedSession({ identity: boundary.identity, status: session.status });
    if (boundary.closeDialog) {
      setOpenReceiptId(null);
    }
    if (boundary.resetPrivateState) {
      setFlow(createInitialFlow(provider.id, selectedService?.id ?? null));
      setPetsState(EMPTY_PETS);
      setDateInput(null);
      setRememberedSlot(null);
      setRetryErrorMessage(null);
    }
  }

  const nextServiceId = selectedService?.id ?? null;
  if (
    !sessionChanged &&
    !isSubmissionLocked(flow.submission) &&
    flow.submission.phase !== "succeeded" &&
    flow.draft.serviceId !== nextServiceId
  ) {
    setFlow(syncFlowService(flow, nextServiceId));
    setDateInput(null);
    setRememberedSlot(null);
    setRetryErrorMessage(null);
  }

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  // Cancel any in-flight booking request when identity changes, logs out, or unmounts.
  useEffect(() => {
    return () => {
      submitControllerRef.current?.abort();
    };
  }, [boundary.identity]);

  const actor = activeCustomerActor(session);
  const customerId = actor?.id ?? null;
  const customerIdentity =
    boundary.mode === "customer" ? boundary.identity : null;

  const loadPets = useCallback(async () => {
    if (!customerId || !customerIdentity) return;
    petsControllerRef.current?.abort();
    const controller = new AbortController();
    petsControllerRef.current = controller;
    const revision = ++petsRevisionRef.current;
    const ticket = privateCache.ticket(["v1", "booking-pets", customerId]);
    setPetsState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const response = await bffRequest(
        "/pets",
        { signal: controller.signal },
        decodePets,
      );
      const allPets = response.body as CustomerPet[];
      if (allPets.some((pet) => pet.ownerId !== customerId)) {
        throw new ApiError("invalid-response");
      }
      const activePets = allPets.filter(
        (pet) => pet.status === "ACTIVE" && pet.ownerId === customerId,
      );
      if (
        controller.signal.aborted ||
        revision !== petsRevisionRef.current ||
        !privateCache.write(ticket, activePets, 0)
      ) {
        return;
      }
      setPetsState({ status: "ready", items: activePets, error: null });
      setFlow((current) => {
        if (
          activePets.length === 1 &&
          !current.draft.petId &&
          current.submission.phase === "editing"
        ) {
          const next = selectFlowField(current, "petId", activePets[0].id);
          flowRef.current = next;
          return next;
        }
        return current;
      });
    } catch (error) {
      if (
        !isRequestCancelled(error) &&
        !controller.signal.aborted &&
        revision === petsRevisionRef.current
      ) {
        setPetsState((current) => ({
          status: "error",
          items: current.items,
          error: apiMessage(error),
        }));
      }
    }
  }, [customerId, customerIdentity]);

  useEffect(() => {
    if (!customerIdentity) {
      petsControllerRef.current?.abort();
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadPets();
    });
    return () => {
      active = false;
      petsControllerRef.current?.abort();
    };
  }, [customerIdentity, loadPets]);

  const cooldownDeadline =
    (flow.submission.phase === "unknown" ||
      flow.submission.phase === "in-progress" ||
      flow.submission.phase === "failed") &&
    flow.submission.error.retryAfterSeconds !== null &&
    flow.submission.error.retryAfterSeconds > 0
      ? flow.submission.failedAt + flow.submission.error.retryAfterSeconds * 1000
      : 0;

  useEffect(() => {
    if (cooldownDeadline <= 0) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownDeadline) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [cooldownDeadline]);

  const commitFlow = useCallback((next: LiveBookingFlow) => {
    flowRef.current = next;
    setFlow(next);
  }, []);

  const serviceSlots = useMemo(() => {
    if (availabilityState.status !== "ready" || !selectedService) return [];
    return availabilityState.data.items.filter(
      (slot) =>
        slot.provider.id === provider.id &&
        slot.service.id === selectedService.id,
    );
  }, [availabilityState, provider.id, selectedService]);

  const locked = isSubmissionLocked(flow.submission);
  const inFlight = isSubmissionInFlight(flow.submission);
  const completed = flow.submission.phase === "succeeded";
  const receipt =
    flow.submission.phase === "succeeded" ? flow.submission.booking : null;
  const lockedAttempt =
    flow.submission.phase === "verifying" ||
    flow.submission.phase === "pending" ||
    flow.submission.phase === "unknown" ||
    flow.submission.phase === "in-progress"
      ? flow.submission.attempt
      : null;

  const selectedPet =
    petsState.items.find((pet) => pet.id === flow.draft.petId) ?? null;

  const selectedSlot = useMemo(() => {
    if (!selectedService || !flow.draft.slotId) return null;
    const liveMatch = serviceSlots.find(
      (slot) => slot.id === flow.draft.slotId,
    );
    if (liveMatch) return liveMatch;
    if (
      rememberedSlot &&
      rememberedSlot.revision === availabilityRevision &&
      rememberedSlot.slot.id === flow.draft.slotId &&
      rememberedSlot.slot.provider.id === provider.id &&
      rememberedSlot.slot.service.id === selectedService.id
    ) {
      return rememberedSlot.slot;
    }
    return null;
  }, [
    availabilityRevision,
    flow.draft.slotId,
    provider.id,
    rememberedSlot,
    selectedService,
    serviceSlots,
  ]);

  const slotOptions = useMemo(() => {
    if (
      selectedSlot &&
      !serviceSlots.some((slot) => slot.id === selectedSlot.id)
    ) {
      return [selectedSlot, ...serviceSlots];
    }
    return serviceSlots;
  }, [selectedSlot, serviceSlots]);

  const dates = useMemo(
    () => availableDatesForSlots(slotOptions, selectedSlot),
    [slotOptions, selectedSlot],
  );

  const activeDate =
    selectedSlot?.slotDate ??
    (dateInput && dates.includes(dateInput) ? dateInput : (dates[0] ?? ""));

  const slotsForDate = useMemo(
    () => slotOptions.filter((slot) => slot.slotDate === activeDate),
    [slotOptions, activeDate],
  );

  const cooldownMs = retryCooldownRemainingMs(flow.submission, now);
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

  const slotMatchesActiveService =
    selectedService !== null &&
    selectedSlot !== null &&
    flow.draft.serviceId === selectedService.id &&
    selectedSlot.provider.id === provider.id &&
    selectedSlot.service.id === selectedService.id;

  const quoteMatchesActiveSelection =
    slotMatchesActiveService &&
    flow.draft.reviewedQuote !== null &&
    flow.draft.reviewedQuote.providerId === provider.id &&
    flow.draft.reviewedQuote.serviceId === selectedService.id &&
    flow.draft.reviewedQuote.slotId === selectedSlot.id &&
    flow.draft.reviewedQuote.petId === flow.draft.petId;

  const currentError =
    flow.submission.phase === "failed" ? flow.submission.error : null;
  const errorMessage = currentError ? t.errors[currentError.code] : null;
  // Reserve the previous error's exact height while retrying so a rapid click
  // stays on the disabled submit button instead of shifting onto "Change provider".
  const feedbackMessage = errorMessage ?? (inFlight ? retryErrorMessage : null);

  const showReceiptDialog = shouldShowReceiptDialog({
    session,
    submission: flow.submission,
    openReceiptId,
  });

  async function dispatchCreateBooking(
    attempt: ReturnType<typeof beginLiveSubmission> extends infer R
      ? R extends { ok: true; attempt: infer A }
        ? A
        : never
      : never,
    controller: AbortController,
  ) {
    try {
      const result = await createBooking(attempt.input, {
        idempotencyKey: attempt.idempotencyKey,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const latestSession = snapshot();
      if (sessionIdentityKey(latestSession) !== attempt.identity) return;
      const settled = settleLiveSubmission(
        flowRef.current,
        attempt.idempotencyKey,
        attempt.identity,
        { kind: "success", result },
      );
      commitFlow(settled);
      setRetryErrorMessage(null);
      if (latestSession.status === "authenticated") {
        setOpenReceiptId(result.booking.id);
      }
      onRefreshAvailability();
    } catch (error) {
      if (isRequestCancelled(error) || controller.signal.aborted) return;
      const latestSession = snapshot();
      if (sessionIdentityKey(latestSession) !== attempt.identity) return;
      const apiError = fromApiErrorInfo(
        classifyBookingError(error, "create-booking"),
      );
      const failedAt = Date.now();
      setNow(failedAt);
      const settled = settleLiveSubmission(
        flowRef.current,
        attempt.idempotencyKey,
        attempt.identity,
        { kind: "error", error: apiError, failedAt },
      );
      commitFlow(settled);
      if (apiError.shouldRefreshAvailability) {
        onRefreshAvailability();
      }
      if (apiError.shouldRefreshPets) {
        void loadPets();
      }
    }
  }

  function handleReview() {
    if (!actor || !selectedService) return;
    const timestamp = Date.now();
    setNow(timestamp);
    const next = reviewFlow(
      flowRef.current,
      actor,
      {
        pet: selectedPet,
        provider,
        service: selectedService,
        slot: selectedSlot,
      },
      timestamp,
    );
    commitFlow(next);
    if (
      next.submission.phase === "failed" &&
      next.submission.error.shouldRefreshAvailability
    ) {
      onRefreshAvailability();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor || !selectedService) return;
    const current = flowRef.current;
    if (
      isSubmissionLocked(current.submission) ||
      current.submission.phase === "succeeded"
    ) {
      return;
    }

    const timestamp = Date.now();
    setNow(timestamp);
    let newKey = "";
    try {
      newKey = createIdempotencyKey();
    } catch {
      newKey = "";
    }

    const begun = beginLiveSubmission(
      current,
      actor,
      {
        pet: selectedPet,
        provider,
        service: selectedService,
        slot: selectedSlot,
      },
      newKey,
      timestamp,
    );
    if (!begun.ok) {
      if (begun.reason === "VALIDATION") {
        commitFlow(begun.flow);
        if (
          begun.flow.submission.phase === "failed" &&
          begun.flow.submission.error.shouldRefreshAvailability
        ) {
          onRefreshAvailability();
        }
      }
      return;
    }

    setRetryErrorMessage(errorMessage);
    commitFlow(begun.flow);

    submitControllerRef.current?.abort();
    const controller = new AbortController();
    submitControllerRef.current = controller;
    const { attempt } = begun;

    // Re-verify live slot availability, price, and time right before creating.
    try {
      const freshSlot = await getPublicAvailabilitySlot(attempt.input.slotId, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (sessionIdentityKey(snapshot()) !== attempt.identity) return;

      const check = validateFreshSlotAgainstQuote(
        actor,
        flowRef.current.draft,
        { pet: selectedPet, provider, service: selectedService },
        freshSlot,
      );
      if (!check.ok) {
        const failedAt = Date.now();
        setNow(failedAt);
        commitFlow(
          failPreSubmitVerification(
            flowRef.current,
            attempt.idempotencyKey,
            attempt.identity,
            check.error,
            failedAt,
          ),
        );
        if (check.error.shouldRefreshAvailability) {
          onRefreshAvailability();
        }
        return;
      }
    } catch (error) {
      if (isRequestCancelled(error) || controller.signal.aborted) return;
      if (sessionIdentityKey(snapshot()) !== attempt.identity) return;
      const preError = fromApiErrorInfo(
        classifyBookingError(error, "get-public-slot"),
      );
      const failedAt = Date.now();
      setNow(failedAt);
      commitFlow(
        failPreSubmitVerification(
          flowRef.current,
          attempt.idempotencyKey,
          attempt.identity,
          preError,
          failedAt,
        ),
      );
      if (preError.shouldRefreshAvailability) {
        onRefreshAvailability();
      }
      return;
    }

    const promoted = promoteToPendingCreate(
      flowRef.current,
      attempt.idempotencyKey,
      attempt.identity,
    );
    if (!promoted.ok) return;
    commitFlow(promoted.flow);
    await dispatchCreateBooking(promoted.attempt, controller);
  }

  async function handleSameKeyRetry() {
    if (!actor) return;
    const timestamp = Date.now();
    setNow(timestamp);
    const begun = beginSameKeyRetry(flowRef.current, actor, timestamp);
    if (!begun.ok) return;
    commitFlow(begun.flow);

    submitControllerRef.current?.abort();
    const controller = new AbortController();
    submitControllerRef.current = controller;
    await dispatchCreateBooking(begun.attempt, controller);
  }

  if (boundary.mode === "session-pending") {
    return (
      <section
        id="booking"
        className={detailStyles.bookingBoundary}
        aria-label={vi.discovery.detail.bookingRegion}
      >
        <Info aria-hidden="true" size={24} />
        <div>
          <h2>{vi.discovery.detail.bookingTitle}</h2>
          <p role="status">{t.sessionPending}</p>
        </div>
      </section>
    );
  }

  if (boundary.mode === "session-error") {
    return (
      <section
        id="booking"
        className={detailStyles.bookingBoundary}
        aria-label={vi.discovery.detail.bookingRegion}
      >
        <Info aria-hidden="true" size={24} />
        <div>
          <h2>{t.sessionErrorTitle}</h2>
          <p role="alert">{t.sessionErrorDescription}</p>
          <div className={detailStyles.bookingActions}>
            <button
              type="button"
              onClick={() => void retrySession().catch(() => {})}
            >
              {t.retrySession}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (boundary.mode === "guest") {
    return (
      <section
        id="booking"
        className={detailStyles.bookingBoundary}
        aria-label={vi.discovery.detail.bookingRegion}
      >
        <Info aria-hidden="true" size={24} />
        <div>
          <h2>{vi.discovery.detail.bookingTitle}</h2>
          <p>{t.guestDescription}</p>
          <div className={detailStyles.bookingActions}>
            <Link
              href="/login"
              prefetch={false}
              className={shell.primaryButton}
            >
              {vi.discovery.detail.login}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (boundary.mode === "non-customer") {
    return (
      <section
        id="booking"
        className={detailStyles.bookingBoundary}
        aria-label={vi.discovery.detail.bookingRegion}
      >
        <Info aria-hidden="true" size={24} />
        <div>
          <h2>{t.nonCustomerTitle}</h2>
          <p>{t.nonCustomerDescription}</p>
          {session.session?.user && (
            <div className={detailStyles.bookingActions}>
              <Link
                href={roleHome(session.session.user.role)}
                prefetch={false}
                className={shell.primaryButton}
              >
                {t.goToMyHome}
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (!selectedService && !locked && !completed) {
    return (
      <section
        id="booking"
        className={detailStyles.bookingBoundary}
        aria-label={vi.discovery.detail.bookingRegion}
      >
        <Info aria-hidden="true" size={24} />
        <div>
          <h2>{vi.booking.title}</h2>
          <p role={serviceLoading ? "status" : undefined}>
            {serviceLoading ? t.serviceLoading : t.selectServiceFirst}
          </p>
        </div>
      </section>
    );
  }

  const displayedServiceName =
    receipt?.service.name ??
    lockedAttempt?.serviceName ??
    selectedService?.name ??
    vi.booking.selectPlaceholder;
  const displayedPrice =
    receipt?.bookedPrice ??
    lockedAttempt?.quote.price ??
    flow.draft.reviewedQuote?.price ??
    selectedSlot?.service.price ??
    selectedService?.price ??
    null;
  const displayedDuration =
    receipt?.service.durationMinutes ??
    lockedAttempt?.quote.serviceDurationMinutes ??
    flow.draft.reviewedQuote?.serviceDurationMinutes ??
    selectedSlot?.service.durationMinutes ??
    selectedService?.durationMinutes ??
    null;
  const displayedAppointment = receipt
    ? `${formatDateOnly(receipt.slot.slotDate)} · ${receipt.slot.startTime.slice(0, 5)}–${receipt.slot.endTime.slice(0, 5)}`
    : lockedAttempt
      ? `${formatDateOnly(lockedAttempt.quote.slotDate)} · ${lockedAttempt.quote.startTime.slice(0, 5)}–${lockedAttempt.quote.endTime.slice(0, 5)}`
      : selectedSlot
        ? `${formatDateOnly(selectedSlot.slotDate)} · ${selectedSlot.startTime.slice(0, 5)}–${selectedSlot.endTime.slice(0, 5)}`
        : vi.booking.selectPlaceholder;

  const availabilityMeta =
    availabilityState.status === "ready" ? availabilityState.data.meta : null;

  return (
    <section
      id="booking"
      className={styles.booking}
      aria-labelledby="booking-title"
    >
      <h2 id="booking-title">{vi.booking.title}</h2>
      <p>{vi.booking.subtitle}</p>
      <form
        className={styles.bookingGrid}
        onSubmit={(event) => void handleSubmit(event)}
        aria-busy={inFlight}
      >
        <div className={styles.steps}>
          <section className={styles.card}>
            <h3>{vi.booking.pet}</h3>
            {petsState.status === "loading" || petsState.status === "idle" ? (
              <p role="status">{t.petsLoading}</p>
            ) : petsState.status === "error" ? (
              <div role="alert" className={styles.notice}>
                <p>{petsState.error ?? t.petsLoadError}</p>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void loadPets()}
                >
                  {t.petsReload}
                </button>
              </div>
            ) : petsState.items.length > 0 ? (
              <label className={styles.field}>
                {vi.booking.choosePet}
                <select
                  value={selectedPet?.id ?? ""}
                  disabled={locked || completed}
                  onChange={(event) =>
                    commitFlow(
                      selectFlowField(
                        flowRef.current,
                        "petId",
                        event.target.value || null,
                      ),
                    )
                  }
                >
                  <option value="">{vi.booking.selectPlaceholder}</option>
                  {petsState.items.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                      {pet.breed ? ` · ${pet.breed}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p role="status">{vi.booking.noPet}</p>
            )}
            <p>{vi.booking.petSharing}</p>
            <Link
              href="/account/pets"
              prefetch={false}
              className={styles.secondary}
            >
              {vi.booking.managePets}
            </Link>
          </section>

          <section className={styles.card}>
            <h3>{vi.booking.service}</h3>
            <p>{vi.booking.selectedService}</p>
            <div className={styles.selectedService}>
              {displayedServiceName} · {formatDuration(displayedDuration)} ·{" "}
              {formatPrice(displayedPrice)}
            </div>
            {locked &&
              lockedAttempt &&
              selectedService &&
              lockedAttempt.serviceId !== selectedService.id && (
                <p role="status">{t.lockedServiceNotice}</p>
              )}
            <a href="#services" className={styles.secondary}>
              {vi.booking.otherServices}
            </a>
          </section>

          <section className={styles.card}>
            <h3>{vi.booking.time}</h3>
            <p>{t.slotNotice}</p>
            {availabilityState.status === "loading" ||
            availabilityState.status === "disabled" ? (
              <p role="status">{t.availabilityLoading}</p>
            ) : availabilityState.status === "error" ? (
              <div role="alert" className={styles.notice}>
                <p>{t.availabilityError}</p>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={onRefreshAvailability}
                >
                  {t.availabilityReload}
                </button>
              </div>
            ) : dates.length === 0 ? (
              <div role="status" className={styles.notice}>
                <p>{vi.booking.noSlots}</p>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={onRefreshAvailability}
                >
                  {t.availabilityReload}
                </button>
              </div>
            ) : (
              <>
                <label className={styles.field}>
                  {vi.booking.chooseDate}
                  <select
                    value={activeDate}
                    disabled={locked || completed}
                    onChange={(event) => {
                      setDateInput(event.target.value);
                      setRememberedSlot(null);
                      commitFlow(selectFlowField(flowRef.current, "slotId", null));
                    }}
                  >
                    {dates.map((date) => (
                      <option key={date} value={date}>
                        {formatDateOnly(date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  {vi.booking.chooseSlot}
                  <select
                    value={
                      selectedSlot?.slotDate === activeDate
                        ? selectedSlot.id
                        : ""
                    }
                    disabled={locked || completed}
                    onChange={(event) => {
                      const nextId = event.target.value || null;
                      const chosen =
                        slotsForDate.find((slot) => slot.id === nextId) ?? null;
                      setRememberedSlot(
                        chosen
                          ? { slot: chosen, revision: availabilityRevision }
                          : null,
                      );
                      commitFlow(
                        selectFlowField(flowRef.current, "slotId", nextId),
                      );
                    }}
                  >
                    <option value="">{vi.booking.selectPlaceholder}</option>
                    {slotsForDate.map((slot) => {
                      const remaining = slot.capacity - slot.bookedCount;
                      return (
                        <option
                          key={slot.id}
                          value={slot.id}
                          disabled={remaining <= 0}
                        >
                          {formatMessage(t.slotOption, {
                            start: slot.startTime.slice(0, 5),
                            end: slot.endTime.slice(0, 5),
                            remaining,
                          })}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {availabilityMeta && availabilityMeta.totalPages > 1 && (
                  <p>
                    {formatMessage(t.availabilityPageHint, {
                      page: availabilityMeta.page,
                      totalPages: availabilityMeta.totalPages,
                    })}
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <aside className={`${styles.card} ${styles.review}`}>
          <h3>{vi.booking.reviewTitle}</h3>
          <p>{vi.booking.reviewDescription}</p>
          <dl className={styles.facts}>
            <dt>{vi.booking.providerLabel}</dt>
            <dd>{receipt?.provider.businessName ?? provider.businessName}</dd>
            <dt>{vi.booking.petLabel}</dt>
            <dd>
              {receipt?.pet.name ??
                selectedPet?.name ??
                vi.booking.selectPlaceholder}
            </dd>
            <dt>{vi.booking.serviceLabel}</dt>
            <dd>{displayedServiceName}</dd>
            <dt>{vi.booking.appointmentLabel}</dt>
            <dd>{displayedAppointment}</dd>
            <dt>{receipt ? t.bookedPriceLabel : vi.booking.priceLabel}</dt>
            <dd>{formatPrice(displayedPrice)}</dd>
            <dt>{vi.booking.durationLabel}</dt>
            <dd>{formatDuration(displayedDuration)}</dd>
            {receipt && (
              <>
                <dt>{t.statusLabel}</dt>
                <dd>
                  <span className={styles.status} data-status={receipt.status}>
                    {vi.booking.statuses[receipt.status]}
                  </span>
                </dd>
              </>
            )}
          </dl>

          <label className={styles.field}>
            {vi.booking.note}
            <textarea
              value={flow.draft.customerNote}
              disabled={locked || completed}
              placeholder={vi.booking.notePlaceholder}
              onChange={(event) =>
                commitFlow(updateFlowNote(flowRef.current, event.target.value))
              }
            />
          </label>
          <p>{vi.booking.pendingNotice}</p>

          {quoteMatchesActiveSelection && !locked && !completed && !currentError && (
            <p role="status">{t.reviewConfirmed}</p>
          )}

          {feedbackMessage && (
            <p
              role={currentError ? "alert" : undefined}
              aria-hidden={currentError ? undefined : true}
              className={`${styles.error} ${currentError ? "" : styles.errorPlaceholder}`}
            >
              {feedbackMessage}
            </p>
          )}

          {cooldownSeconds > 0 && (
            <p role="status">
              {formatMessage(t.cooldownWait, { seconds: cooldownSeconds })}
            </p>
          )}

          {(flow.submission.phase === "unknown" ||
            flow.submission.phase === "in-progress") && (
            <div role="status" className={styles.notice}>
              <p>
                <strong>
                  {flow.submission.phase === "in-progress"
                    ? t.inProgressTitle
                    : t.unknownTitle}
                </strong>
              </p>
              <p>
                {flow.submission.phase === "in-progress"
                  ? t.inProgressDescription
                  : t.unknownDescription}
              </p>
              <button
                type="button"
                className={styles.primary}
                disabled={cooldownSeconds > 0}
                onClick={() => void handleSameKeyRetry()}
              >
                {t.retrySameRequest}
              </button>
              <Link
                href="/bookings"
                prefetch={false}
                className={styles.secondary}
              >
                {vi.booking.viewList}
              </Link>
            </div>
          )}

          {receipt ? (
            <div role="status" className={styles.notice}>
              <p>{formatMessage(vi.booking.success, { bookingId: receipt.id })}</p>
              {flow.submission.phase === "succeeded" &&
                flow.submission.idempotentReplayed && (
                  <p>{t.replayedNotice}</p>
                )}
              <Link
                id={`live-booking-receipt-${provider.id}`}
                className={styles.primary}
                href={`/bookings/${encodeURIComponent(receipt.id)}`}
                prefetch={false}
              >
                {vi.booking.viewBooking}
              </Link>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setOpenReceiptId(null);
                  setDateInput(null);
                  setRememberedSlot(null);
                  setRetryErrorMessage(null);
                  commitFlow(
                    resetFlowForNewBooking(
                      flowRef.current,
                      selectedService?.id ?? null,
                      petsState.items.length === 1 ? petsState.items[0].id : null,
                    ),
                  );
                }}
              >
                {vi.booking.newBooking}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondary}
                disabled={
                  locked ||
                  availabilityState.status !== "ready" ||
                  petsState.status !== "ready"
                }
                onClick={handleReview}
              >
                {vi.booking.review}
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={
                  locked ||
                  cooldownSeconds > 0 ||
                  availabilityState.status !== "ready" ||
                  petsState.status !== "ready" ||
                  !quoteMatchesActiveSelection
                }
              >
                {flow.submission.phase === "verifying"
                  ? t.verifying
                  : flow.submission.phase === "pending"
                    ? flow.submission.isRetry
                      ? t.retryingSameRequest
                      : vi.booking.submitting
                    : vi.booking.submit}
              </button>
            </>
          )}

          <Link href="/discover" className={styles.secondary}>
            {vi.booking.changeProvider}
          </Link>
        </aside>
      </form>

      {showReceiptDialog && receipt && (
        <CustomerDialog
          title={formatMessage(vi.booking.success, { bookingId: receipt.id })}
          description={t.successDescription}
          busy={false}
          onClose={() => setOpenReceiptId(null)}
          returnFocusId={`live-booking-receipt-${provider.id}`}
        >
          {flow.submission.phase === "succeeded" &&
            flow.submission.idempotentReplayed && <p>{t.replayedNotice}</p>}
          <div className={styles.dialogActions}>
            <Link
              className={styles.primary}
              href={`/bookings/${encodeURIComponent(receipt.id)}`}
              prefetch={false}
            >
              {vi.booking.viewBooking}
            </Link>
            <Link
              className={styles.secondary}
              href="/bookings"
              prefetch={false}
            >
              {vi.booking.viewList}
            </Link>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setOpenReceiptId(null)}
            >
              {vi.booking.close}
            </button>
          </div>
        </CustomerDialog>
      )}
    </section>
  );
}
