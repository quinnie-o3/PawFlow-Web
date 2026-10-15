"use client";

import { useRef, useState } from "react";
import { createServicesMock } from "./data/providerServicesMock";
import { applyServiceCommand } from "./serviceLogic";
import type { ServiceCommand, ServicesState } from "./types";

export function useServicesMock() {
  const [state, setState] = useState(createServicesMock);
  const current = useRef(state);

  function replace(next: ServicesState) {
    current.current = next;
    setState(next);
  }
  function submit(command: ServiceCommand, simulateFailure: boolean) {
    const next = applyServiceCommand(current.current, command, simulateFailure);
    replace(next);
    return next.feedback!;
  }
  return {
    state,
    submit,
    clearFeedback: () => replace({ ...current.current, feedback: null }),
    reset: (empty = false) => replace(createServicesMock(empty)),
  };
}
