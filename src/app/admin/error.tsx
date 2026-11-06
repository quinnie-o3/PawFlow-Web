"use client";

import { vi } from "@/lib/locale";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section><h1>{vi.admin.route.errorTitle}</h1><p role="alert">{vi.admin.route.errorDescription}</p><button type="button" onClick={reset}>{vi.common.actions.retry}</button></section>;
}
