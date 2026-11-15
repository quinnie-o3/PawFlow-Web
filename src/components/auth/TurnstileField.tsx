"use client";

import { useId } from "react";
import type { TurnstileProtectedSubmit } from "@/features/auth/hooks/useTurnstileProtectedSubmit";
import { turnstileNeedsRetry, turnstileStatusMessage } from "@/features/auth/turnstile/turnstileTokenState";
import TurnstileWidget from "./TurnstileWidget";

type TurnstileFieldProps = {
  turnstile: TurnstileProtectedSubmit;
};

/** Turnstile widget plus an accessible status line and a manual retry control. */
export default function TurnstileField({ turnstile }: TurnstileFieldProps) {
  const statusId = useId();
  const { status } = turnstile;
  const isProblem = turnstileNeedsRetry(status);

  return (
    <div className="flex w-full flex-col gap-1" role="group" aria-label="Xác minh chống bot" aria-describedby={statusId}>
      <TurnstileWidget {...turnstile.widgetProps} />
      <div className="flex min-h-[18px] items-center gap-2 text-[12px] leading-[18px]">
        <p id={statusId} role={isProblem ? "alert" : "status"} aria-live={isProblem ? "assertive" : "polite"} className={isProblem ? "text-red-600" : "text-[var(--text-secondary)]"}>
          {turnstileStatusMessage(status)}
        </p>
        {isProblem ? (
          <button type="button" onClick={turnstile.retryChallenge} className="ml-auto shrink-0 font-semibold text-[var(--accent-hover)] hover:underline focus-visible:underline">
            Thử lại
          </button>
        ) : null}
      </div>
    </div>
  );
}
