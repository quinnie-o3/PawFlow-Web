import { ApiError } from "./errors";

/** Read lazily: importing a public/mock page does not require API configuration. */
export function apiBaseUrl(value = process.env.NEXT_PUBLIC_API_URL): string {
  if (!value?.trim()) throw new ApiError("config");
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.href.replace(/\/+$/, "");
  } catch { throw new ApiError("config"); }
}

/** Paths are relative to the configured base (which already includes /api). */
export function apiUrl(base: string, path: string): string {
  if (!/^\/(?!\/)/.test(path) || /[\\\u0000-\u0020#]/.test(path)) throw new ApiError("config");
  const root = new URL(apiBaseUrl(base) + "/");
  const result = new URL(path.slice(1), root);
  if (result.origin !== root.origin || !result.pathname.startsWith(root.pathname)) throw new ApiError("config");
  return result.href;
}
