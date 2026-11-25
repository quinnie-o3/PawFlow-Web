import { decodeSession } from "../../session/model";
import { AuthApiError, postAuthJson, type PostAuthJsonOptions } from "./authApi";

/** Body of `POST /auth/login` (backend `LoginDto`). */
export type LoginCustomerPayload = {
  email: string;
  password: string;
  /** Fresh, single-use token from a Turnstile widget rendered with action `login`. */
  turnstileToken: string;
};

export { AuthApiError as LoginCustomerError };
export async function loginCustomer(payload: LoginCustomerPayload, options: PostAuthJsonOptions = {}) {
  const { body } = await postAuthJson("login", payload, options);
  return decodeSession(body);
}
