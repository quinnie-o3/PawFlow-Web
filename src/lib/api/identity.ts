import { QueryCache } from "./queryCache";

export type BackendRole = "CUSTOMER" | "PROVIDER_OWNER" | "PROVIDER_STAFF" | "ADMIN";
export type ConfirmedIdentity = { id: string; role: BackendRole; status: "ACTIVE" };
export type IdentityState = { status: "unknown" } | { status: "anonymous" } | { status: "confirmed"; user: ConfirmedIdentity };

/** Decode only the response of /auth/me. Never derive identity from a fixture or JWT payload. */
export function decodeIdentity(body: unknown): ConfirmedIdentity {
  const user = (body as { user?: Record<string, unknown> } | null)?.user;
  if (!user || typeof user.id !== "string" || !/^[1-9]\d*$/.test(user.id) || user.status !== "ACTIVE" ||
    !["CUSTOMER", "PROVIDER_OWNER", "PROVIDER_STAFF", "ADMIN"].includes(String(user.role))) throw new Error("Invalid identity response");
  return { id: user.id, role: user.role as BackendRole, status: "ACTIVE" };
}

/** Integration seam for the future bootstrap; this does not install a live route guard. */
export function createIdentityBoundary(cache = new QueryCache()) {
  let state: IdentityState = { status: "unknown" };
  return {
    cache,
    snapshot: () => state,
    acceptBackendResponse: (body: unknown) => {
      try {
        const user = decodeIdentity(body);
        cache.changeSession(user.id); state = { status: "confirmed", user };
      } catch (error) {
        cache.changeSession(null); state = { status: "anonymous" }; throw error;
      }
    },
    clear: () => { cache.changeSession(null); state = { status: "anonymous" }; },
  };
}

/** UX decisions only. Every protected API still enforces permissions on the backend. */
export function guardDecision(state: IdentityState, roles?: readonly BackendRole[]) {
  if (state.status === "unknown") return "pending";
  if (state.status === "anonymous") return "login";
  return !roles || roles.includes(state.user.role) ? "allow" : "forbidden";
}
