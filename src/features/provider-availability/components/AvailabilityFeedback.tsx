"use client";

import { useEffect, useRef } from "react";
import type { AvailabilityFeedback as AvailabilityFeedbackData } from "../types";
import styles from "../availability.module.css";

export default function AvailabilityFeedback({
  feedback,
  focus = false,
}: {
  feedback: AvailabilityFeedbackData | null;
  focus?: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const message = feedback?.message ?? "";

  useEffect(() => {
    if (focus && message) {
      ref.current?.focus();
    }
  }, [focus, message]);

  if (!feedback || !message) return null;

  return (
    <p
      ref={ref}
      tabIndex={focus ? -1 : undefined}
      role={feedback.outcome === "error" ? "alert" : "status"}
      className={feedback.outcome === "error" ? styles.error : styles.success}
    >
      {message}
    </p>
  );
}
