export function petMockDelay(signal: AbortSignal, milliseconds = 600): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(new DOMException("Mock operation cancelled", "AbortError")); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
