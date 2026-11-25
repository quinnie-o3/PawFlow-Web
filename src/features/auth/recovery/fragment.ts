/** Extract only the backend's opaque one-time token format; never use query parameters. */
export function recoveryTokenFromFragment(fragment: string): string | null {
  const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  const tokens = params.getAll("token");
  return tokens.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(tokens[0]) ? tokens[0] : null;
}
