"use client";

import { useEffect, useRef, useState } from "react";
import { LatestRequest } from "../mockRepository";

type Resource<T> = { key: string; status: "ready"; data: T } | { key: string; status: "error"; error: string };
export function useMockResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>) {
  const gate = useRef(new LatestRequest());
  const [resource, setResource] = useState<Resource<T> | null>(null);
  useEffect(() => {
    const controller = new AbortController(); const current = gate.current; const ticket = current.start();
    loader(controller.signal).then(data => {
      if (!controller.signal.aborted && current.isCurrent(ticket)) setResource({ key, status: "ready", data });
    }, error => {
      if (!controller.signal.aborted && current.isCurrent(ticket)) setResource({ key, status: "error", error: error instanceof Error ? error.message : "Không tải được dữ liệu mô phỏng." });
    });
    return () => { current.cancel(ticket); controller.abort(); };
  }, [key, loader]);
  return resource?.key === key ? resource : { key, status: "loading" as const };
}
