import type { ReactNode } from "react";

/** Keep errors beside the form; the caller retains draft state and owns retry. */
export function FormFeedback({ message, tone = "error", id, className, children }: {
  message: string | null; tone?: "error" | "status"; id?: string; className?: string; children?: ReactNode;
}) {
  if (!message) return null;
  return <div id={id} className={className} role={tone === "error" ? "alert" : "status"} aria-atomic="true">
    <p>{message}</p>{children}
  </div>;
}

export function FieldError({ id, message, className }: { id: string; message?: string; className?: string }) {
  return message ? <p id={id} className={className}>{message}</p> : null;
}
