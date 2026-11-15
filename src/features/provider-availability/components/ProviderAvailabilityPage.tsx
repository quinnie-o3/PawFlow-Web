"use client";

import { vi, formatMessage } from "@/lib/locale";

import { useReducer, useState } from "react";
import Link from "next/link";
import { availabilityCommandError, availabilityReducer, formatAvailabilityDate, formatRanges, localDate, upcomingSlots, weeklyHours } from "../availabilityLogic";
import { availabilityMockNow, createAvailabilityMock } from "../data/providerAvailabilityMock";
import type { AvailabilityCommand, AvailabilitySlot, DateException, WeeklySchedule } from "../types";
import AvailabilitySummary from "./AvailabilitySummary";
import ExceptionList from "./ExceptionList";
import UpcomingSlots from "./UpcomingSlots";
import WeeklyScheduleView from "./WeeklySchedule";
import WeeklyHoursDialog from "./WeeklyHoursDialog";
import ExceptionDialog from "./ExceptionDialog";
import SlotDialog from "./SlotDialog";
import SlotsDialog from "./SlotsDialog";
import styles from "../availability.module.css";

type Dialog = { type: "weekly"; schedule: WeeklySchedule } | { type: "exception"; initial: DateException; blockDay: boolean } | { type: "slot"; initial: AvailabilitySlot } | { type: "slots" } | null;

export default function ProviderAvailabilityPage() {
  const [state, dispatch] = useReducer(availabilityReducer, false, createAvailabilityMock);
  const [dialog, setDialog] = useState<Dialog>(null);
  const now = availabilityMockNow;
  const today = localDate(now);
  const currentDays = weeklyHours(state, today);
  const activeSchedule = [...state.schedules].filter((schedule) => schedule.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  function openDialog(next: Dialog) { dispatch({ type: "clearFeedback" }); setDialog(next); }
  function closeDialog() {
    setDialog(null);
    // Shared dialog restores its trigger; a deleted row or replaced modal needs a fallback.
    window.requestAnimationFrame(() => { if (document.activeElement === document.body) document.getElementById("availability-title")?.focus(); });
  }
  function submit(command: AvailabilityCommand, simulateFailure: boolean) {
    const valid = !availabilityCommandError(state, command, now) && !simulateFailure;
    dispatch({ type: "command", command, now, simulateFailure });
    return valid;
  }
  function selectSlot(id: string) {
    const slot = state.slots.find((item) => item.id === id);
    if (slot) openDialog({ type: "slot", initial: slot });
  }
  function createSlot() {
    openDialog({ type: "slot", initial: { id: `mock-${crypto.randomUUID()}`, serviceId: "", date: today, start: "", end: "", capacity: 1, open: true } });
  }
  function createException(blockDay: boolean) {
    openDialog({ type: "exception", initial: { id: `mock-${crypto.randomUUID()}`, date: "", ranges: [] }, blockDay });
  }

  return <div className={styles.page}>
    <div className={styles.providerTab}>{vi.provider.availability.page.providerTab}</div>
    <div className={styles.intro}>
      <div><h1 id="availability-title" tabIndex={-1}>{vi.provider.availability.page.title}</h1><p>{vi.provider.availability.page.description}</p></div>
      <button type="button" className={styles.blockButton} onClick={() => createException(true)}>{vi.provider.availability.exception.blockDay}</button>
    </div>
    <AvailabilitySummary state={state} />
    {state.feedback && !dialog && <p role={state.feedback.outcome === "error" ? "alert" : "status"} className={state.feedback.outcome === "error" ? styles.error : styles.success}>{state.feedback.message}</p>}
    <div className={styles.scheduleGrid}>
      <WeeklyScheduleView days={currentDays} />
      <ExceptionList now={now} exceptions={state.exceptions} onEdit={(exception) => openDialog({ type: "exception", initial: exception, blockDay: false })} onAdd={() => createException(false)} />
    </div>
    <div className={styles.rulesGrid}>
      <section className={styles.card} aria-labelledby="booking-rules-title">
        <h2 id="booking-rules-title">{vi.provider.availability.rules.title}</h2>
        <p>{vi.provider.availability.rules.duration}</p><p>{vi.provider.availability.rules.capacity}</p><p>{vi.provider.availability.rules.closedDays}</p>
        <button type="button" className={styles.textButton} onClick={() => openDialog({ type: "weekly", schedule: activeSchedule })}>{vi.provider.availability.weekly.edit}</button>
        <nav className={styles.slotActions} aria-label={vi.provider.availability.rules.relatedNavigation}>
          <Link href="/dashboard/services" prefetch={false} className={styles.textButton}>{vi.provider.availability.rules.viewServices}</Link>
          <Link href="/dashboard/profile" prefetch={false} className={styles.textButton}>{vi.provider.availability.rules.providerProfile}</Link>
        </nav>
      </section>
      <UpcomingSlots slots={upcomingSlots(state, now)} reservations={state.reservations} onSelect={selectSlot} onShowAll={() => openDialog({ type: "slots" })} />
    </div>
    <div className={styles.slotActions}><button type="button" className={styles.outlineButton} onClick={createSlot}>{vi.provider.availability.slot.create}</button><button type="button" className={styles.outlineButton} onClick={() => openDialog({ type: "slots" })}>{formatMessage(vi.provider.availability.page.manageSlots, { count: state.slots.length })}</button></div>
    <details className={styles.history}>
      <summary>{formatMessage(vi.provider.availability.page.weeklyHistory, { count: state.schedules.length, date: formatAvailabilityDate(activeSchedule.effectiveFrom) })}</summary>
      {state.schedules.map((schedule) => <details key={schedule.effectiveFrom}>
        <summary>{schedule.effectiveFrom > today ? formatMessage(vi.provider.availability.page.scheduleStartUpcoming, { date: formatAvailabilityDate(schedule.effectiveFrom) }) : formatMessage(vi.provider.availability.page.scheduleStart, { date: formatAvailabilityDate(schedule.effectiveFrom) })}</summary>
        <ul>{schedule.days.map((day) => <li key={day.weekday}>{day.label}: {formatRanges(day.ranges)}</li>)}</ul>
        {schedule.effectiveFrom >= today && <button type="button" className={styles.textButton} onClick={() => openDialog({ type: "weekly", schedule })}>{formatMessage(vi.provider.availability.page.editSchedule, { date: formatAvailabilityDate(schedule.effectiveFrom) })}</button>}
      </details>)}
    </details>
    <div className={styles.mockNote}>
      <p>{vi.provider.availability.mock.clockNote}</p>
      <p>{vi.provider.availability.mock.persistenceNote}</p>
    </div>
    <details className={styles.mockTools}>
      <summary>{vi.provider.availability.mock.title}</summary>
      <p>{vi.provider.availability.mock.resetNote}</p>
      <div className={styles.slotActions}><button type="button" className={styles.softButton} onClick={() => dispatch({ type: "reset", state: createAvailabilityMock(true) })}>{vi.provider.availability.mock.empty}</button><button type="button" className={styles.softButton} onClick={() => dispatch({ type: "reset", state: createAvailabilityMock() })}>{vi.provider.availability.mock.restore}</button></div>
    </details>

    {dialog?.type === "weekly" && <WeeklyHoursDialog state={state} initial={dialog.schedule} now={now} onSubmit={submit} onClose={closeDialog} />}
    {dialog?.type === "exception" && <ExceptionDialog state={state} initial={dialog.initial} blockDay={dialog.blockDay} now={now} onSubmit={submit} onClose={closeDialog} />}
    {dialog?.type === "slot" && <SlotDialog state={state} initial={dialog.initial} now={now} onSubmit={submit} onClose={closeDialog} />}
    {dialog?.type === "slots" && <SlotsDialog state={state} now={now} onSelect={selectSlot} onCreate={createSlot} onClose={closeDialog} />}
  </div>;
}
