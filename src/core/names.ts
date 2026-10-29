import { refuse } from "./answers.ts";

// Name rules (SF-ADR-008 §4): collections and fields [a-z][a-z0-9_]{0,31}, the _ prefix reserved;
// ids [A-Za-z0-9_-]{1,64}.
export const NAME = /^[a-z][a-z0-9_]{0,31}$/;
export const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function checkCollection(name: unknown): string {
  if (typeof name !== "string" || !NAME.test(name)) refuse("bad collection name", String(name));
  return name;
}

export function checkId(id: unknown): string {
  if (typeof id !== "string" || !ID.test(id)) refuse("bad id", String(id));
  return id;
}

export const docKey = (collection: string, id: string): string => `${collection}/${id}`;
