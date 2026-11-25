import { decodeIdentity, type BackendRole } from "../../lib/api/identity";
export type User = {
  id: string;
  role: BackendRole;
  status: "ACTIVE";
  fullName: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
};
export type SessionView = { generation: string; user: User | null };
export function decodeUser(body: unknown): User {
  const identity = decodeIdentity(body),
    user = (body as { user: Record<string, unknown> }).user;
  if (
    typeof user.fullName !== "string" ||
    typeof user.email !== "string" ||
    !(user.phone === null || typeof user.phone === "string")
  )
    throw new Error("Invalid user");
  return {
    ...identity,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified === true,
  };
}
export function decodeSession(body: unknown): SessionView {
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as SessionView).generation !== "string"
  )
    throw new Error("Invalid session");
  const value = body as SessionView;
  return {
    generation: value.generation,
    user: value.user === null ? null : decodeUser(value),
  };
}
export function roleHome(role: BackendRole) {
  return role === "CUSTOMER"
    ? "/account"
    : role === "ADMIN"
      ? "/admin"
      : role === "PROVIDER_STAFF"
        ? "/staff/bookings"
        : "/dashboard";
}
