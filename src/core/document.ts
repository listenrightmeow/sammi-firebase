import { refuse } from "./answers.ts";
import { byteSize, toWire, type Fields } from "./docs.ts";
import { host } from "./host.ts";
import { NAME, checkCollection, checkId } from "./names.ts";
import { requireConnected } from "./run.ts";
import type { PendingOp, StoredDoc } from "./state.ts";
import { clearPending, dropDoc, getDoc, publish, putDoc, putPending, userPath, writeHashes } from "./store.ts";
import { pushOp } from "./sync.ts";

// The write side of the Document aggregate: invariants DOC-01 to DOC-06 and mirror rule 1
// (validate → mirror → ini → pending → variable → event → cloud → drop pending on ack).

export const FIELD_MAX = 4096;
export const DOC_MAX = 8192;

export interface Target {
  uid: string;
  collection: string;
  id: string;
}

/** NOT_CONNECTED, then BAD_COLLECTION_NAME, then BAD_ID: the order every document command checks. */
export function target(input: { collection?: unknown; id?: unknown }, opts: { blankId?: boolean } = {}): Target {
  const uid = requireConnected();
  const collection = checkCollection(input.collection);
  const id = opts.blankId && input.id === "" ? host().ports.pushId() : checkId(input.id);
  return { uid, collection, id };
}

export function fieldName(field: unknown): string {
  if (typeof field !== "string" || !NAME.test(field)) refuse("bad field", String(field));
  return field;
}

/** A field value as stored: a string or a finite number (DOC-02). */
export function fieldValue(field: string, value: unknown): string | number {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  refuse("bad field", field);
}

/** The fields box of Create, Replace and Update: a JSON object of strings and numbers. */
export function parseFieldsBox(text: unknown): Fields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    refuse("bad field");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) refuse("bad field");
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) refuse("bad field");
  const fields: Fields = {};
  for (const [k, v] of entries) fields[fieldName(k)] = fieldValue(k, v);
  return fields;
}

/** Text typed in a SAMMI box: numeric text is a number, a str: prefix forces a string. */
export function boxValue(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value);
  if (text.startsWith("str:")) return text.slice(4);
  return /^-?(0|[1-9]\d*)(\.\d+)?$/.test(text) ? Number(text) : text;
}

/** Strictness (SF-ADR-008 §3) and the size caps (S12, DOC-03). */
export function checkFields(collection: string, id: string, fields: Fields, changed: Iterable<string>): void {
  const schema = host().state.schema.get(collection);
  if (schema?.strict) {
    for (const f of changed) if (!schema.fields.includes(f)) refuse("unknown field", f);
  }
  for (const f of changed) if (byteSize(fields[f]) > FIELD_MAX) refuse("too large", f);
  if (byteSize(fields) > DOC_MAX) refuse("too large", `${collection}/${id}`);
}

export function stamped(fields: Fields): StoredDoc {
  const { ports, state } = host();
  return { fields, t: ports.now(), d: state.deviceId };
}

/**
 * Rule 1 for a local write. `after` undefined is a delete. `wholeDocument` sends set() instead of
 * the operation (a document created by Set Field). A failed cloud write leaves the pending entry
 * for the next reconcile: the command still succeeded locally (SF-ADR-004).
 */
export async function commit(
  t: Target,
  after: StoredDoc | undefined,
  op: PendingOp,
  announce: () => Promise<void>,
  opts: { wholeDocument?: boolean } = {},
): Promise<void> {
  const { ports } = host();
  if (after) await putDoc(t.collection, t.id, after);
  else await dropDoc(t.collection, t.id);
  await writeHashes();
  await putPending(t.collection, t.id, op);
  await publish(t.collection);
  await announce();
  const path = userPath(t.uid, `collections/${t.collection}/${t.id}`);
  try {
    if (opts.wholeDocument && after) await ports.db.set(path, toWire(after));
    else await pushOp(path, op, after ?? stamped({}));
    await clearPending(t.collection, t.id);
  } catch {
    // Offline: the operation stays in [pending] and is replayed by the next reconcile (rule 4).
  }
}

export const current = (t: Target): StoredDoc | undefined => getDoc(t.collection, t.id);
