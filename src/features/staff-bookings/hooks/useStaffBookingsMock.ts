"use client";

import { useEffect, useReducer } from "react";
import { mockStaffContext, staffBookingsMock } from "../data/staffBookingsMock";
import { createStaffSession, staffSessionReducer, type StaffSessionAction } from "../staffBookingSession";
import type { StaffBookingCommand, StaffMockScenario, StaffSessionState } from "../types";

function reducer(state: StaffSessionState, action: StaffSessionAction) {
  return staffSessionReducer(state, action, mockStaffContext);
}

export function useStaffBookingsMock() {
  const [state, dispatch] = useReducer(reducer, staffBookingsMock, createStaffSession);

  useEffect(() => {
    if (state.phase !== "loading") return;
    const timer = window.setTimeout(() => dispatch({ type: "loaded" }), 250);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.scenario]);

  useEffect(() => {
    const command = state.pendingCommand;
    if (!command) return;
    const timer = window.setTimeout(() => dispatch({ type: "resolve", command }), 300);
    return () => window.clearTimeout(timer);
  }, [state.pendingCommand]);

  function load(scenario: StaffMockScenario) {
    dispatch({ type: "load", scenario });
  }

  return {
    state, dispatch, load,
    submit: (command: StaffBookingCommand) => dispatch({ type: "submit", command }),
    retry: () => load("normal"),
    reset: () => dispatch({ type: "reset", bookings: staffBookingsMock }),
  };
}
