import type { Answer } from "./answers.ts";
import type { AuthFailure } from "./ports.ts";

/** What an SDK sign-in error means. A missing connection, or a library that could not load, is not a bad password. */
export function signInFailure(error: string): AuthFailure {
  if (/operation-not-allowed/.test(error)) return "provider disabled";
  if (/api-key/.test(error)) return "api key invalid";
  if (/network-request-failed|Failed to fetch|dynamically imported/.test(error)) return "no internet";
  return "credentials invalid";
}

/** A stored session that no longer signs in at start is a lost session, reported once (failure 5). */
export function lostSessionAtStart(hadSession: boolean, res: Answer): boolean {
  return hadSession && res.status === "ERR" && res.body.code === "CREDENTIALS_INVALID";
}
