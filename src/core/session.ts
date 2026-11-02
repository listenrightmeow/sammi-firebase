import type { Answer } from "./answers.ts";

/** A stored session that no longer signs in at start is a lost session, reported once (failure 5). */
export function lostSessionAtStart(hadSession: boolean, res: Answer): boolean {
  return hadSession && res.status === "ERR" && res.body.code === "CREDENTIALS_INVALID";
}
