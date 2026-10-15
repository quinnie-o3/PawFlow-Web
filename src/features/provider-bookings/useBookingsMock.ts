"use client";

import { useEffect, useReducer } from "react";
import { createMockState, mockBookingsReducer } from "./bookingLogic";
import { mockBookings, mockNow, mockOwner } from "./data/providerBookingsMock";

export function useBookingsMock() {
  const [state, dispatch] = useReducer(mockBookingsReducer, mockBookings, createMockState);
  useEffect(() => {
    if (!state.pending) return;
    const timer = window.setTimeout(() => dispatch({ type: "resolve", actor: mockOwner, now: mockNow }), 400);
    return () => window.clearTimeout(timer);
  }, [state.pending]);
  return { state, dispatch };
}
