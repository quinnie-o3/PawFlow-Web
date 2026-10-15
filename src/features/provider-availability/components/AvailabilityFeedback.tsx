import { useEffect, useRef } from "react";
import type { AvailabilityState } from "../types";
import styles from "../availability.module.css";

export default function AvailabilityFeedback({ error, feedback }: { error?: string; feedback: AvailabilityState["feedback"] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const message = error || feedback?.message;
  const failed = !!error || feedback?.outcome === "error";
  useEffect(() => { if (message) ref.current?.focus(); }, [message]);
  return message ? <p ref={ref} tabIndex={-1} role={failed ? "alert" : "status"} className={failed ? styles.error : styles.success}>{message}</p> : null;
}
