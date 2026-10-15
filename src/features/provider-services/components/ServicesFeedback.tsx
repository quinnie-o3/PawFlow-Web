import { useEffect, useRef } from "react";
import type { ServiceFeedback } from "../types";
import styles from "../services.module.css";

export default function ServicesFeedback({ feedback, focus = true }: { feedback: ServiceFeedback | null; focus?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (feedback && focus) ref.current?.focus(); }, [feedback, focus]);
  if (!feedback) return null;
  return <p ref={ref} tabIndex={-1} role={feedback.outcome === "error" ? "alert" : "status"} className={feedback.outcome === "error" ? styles.error : styles.success}>{feedback.message}</p>;
}
