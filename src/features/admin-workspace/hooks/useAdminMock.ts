"use client";

import { useEffect, useState } from "react";
import type { AdminRecord } from "../types";

type MockState = { status: "loading" | "error" | "ready"; records: readonly AdminRecord[] };

/** Local async fixture lifecycle. No API, persistence, or business mutations. */
export function useAdminMock(fixture: readonly AdminRecord[]) {
  const [request, setRequest] = useState({ scenario: "normal", revision: 0 });
  const [state, setState] = useState<MockState>({ status: "loading", records: [] });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(request.scenario === "error"
        ? { status: "error", records: [] }
        : { status: "ready", records: request.scenario === "empty" ? [] : fixture });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fixture, request]);

  function load(scenario: "normal" | "empty" | "error" = "normal") {
    setState({ status: "loading", records: [] });
    setRequest((previous) => ({ scenario, revision: previous.revision + 1 }));
  }

  return { ...state, load };
}
