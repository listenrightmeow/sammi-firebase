import type { StoredDoc } from "./state.ts";

export type Fields = Record<string, string | number>;

/** The ini and cloud form of a document: its fields, then _t and _d (docs/06). */
export function toWire(doc: StoredDoc): Record<string, string | number> {
  return { ...doc.fields, _t: doc.t, _d: doc.d };
}

export function docText(doc: StoredDoc): string {
  return JSON.stringify(toWire(doc));
}

export function sameFields(a: Fields, b: Fields): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/**
 * Mirror rule 2 (docs/06): a newer stamp wins, and so does an edit made outside the extension, such
 * as in the Firebase console, which changes a field and leaves _t and _d as they were. Equal stamps
 * from two devices keep local.
 */
export function remoteWins(remote: StoredDoc, local: StoredDoc): boolean {
  if (remote.t !== local.t) return remote.t > local.t;
  return remote.d === local.d && !sameFields(remote.fields, local.fields);
}

/** Parse a stored document; undefined when the value is not a valid document. */
export function fromWire(value: unknown): StoredDoc | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const fields: Fields = {};
  let t = 0;
  let d = "";
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "_t") {
      if (typeof v !== "number") return undefined;
      t = v;
    } else if (k === "_d") {
      if (typeof v !== "string") return undefined;
      d = v;
    } else if (typeof v === "string" || typeof v === "number") {
      fields[k] = v;
    } else {
      return undefined;
    }
  }
  return { fields, t, d };
}

export function parseDocText(text: string): StoredDoc | undefined {
  try {
    return fromWire(JSON.parse(text));
  } catch {
    return undefined;
  }
}

/** A copy of the fields without one of them. */
export const without = (fields: Fields, key: string): Fields =>
  Object.fromEntries(Object.entries(fields).filter(([k]) => k !== key));

/** JSON text a SAMMI box receives: compact, fields only. */
export const fieldsText = (fields: Fields): string => JSON.stringify(fields);

/** UTF-8 byte length of the JSON text: the unit of the 8 KB and 4 KB caps (S12). */
export const byteSize = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;
