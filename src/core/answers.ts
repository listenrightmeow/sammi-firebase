// The answer shape and the reason registry (SF-ADR-013, contracts/command-answer.json).

export type Reason =
  | "not connected"
  | "already connected"
  | "config incomplete"
  | "invalid config"
  | "credentials invalid"
  | "provider disabled"
  | "api key invalid"
  | "bad collection name"
  | "not defined"
  | "bad id"
  | "exists"
  | "missing"
  | "bad field"
  | "unknown field"
  | "too large"
  | "not a number"
  | "not two-way"
  | "bad operator"
  | "remote older"
  | "own echo"
  | "remote schema older";

export interface Answer {
  status: "OK" | "ERR";
  body: Record<string, unknown>;
}

export function ok(body: { answer: string } & Record<string, unknown>): Answer {
  return { status: "OK", body };
}

export function code(reason: Reason): string {
  return reason.toUpperCase().replace(/[ -]/g, "_");
}

export function fail(reason: Reason, detail?: string): Answer {
  return { status: "ERR", body: { code: code(reason), answer: `error: ${reason}${detail ? ` ${detail}` : ""}` } };
}

/** A refusal raised anywhere inside a handler and turned into its answer at the edge. */
export class Refusal extends Error {
  readonly reason: Reason;
  readonly detail: string | undefined;
  constructor(reason: Reason, detail?: string) {
    super(`${reason}${detail ? ` ${detail}` : ""}`);
    this.reason = reason;
    this.detail = detail;
  }
}

export function refuse(reason: Reason, detail?: string): never {
  throw new Refusal(reason, detail);
}
