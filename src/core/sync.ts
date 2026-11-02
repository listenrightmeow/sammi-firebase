import { host } from "./host.ts";
import { crc32 } from "./crc32.ts";
import { fieldsText, fromWire, remoteWins, toWire, without, type Fields } from "./docs.ts";
import { emit } from "./events.ts";
import { docKey } from "./names.ts";
import type { PendingOp, StoredDoc } from "./state.ts";
import {
  clearPending,
  getDoc,
  publish,
  putDoc,
  putPending,
  putSchema,
  userPath,
  writeCollections,
  writeHashes,
  writeIds,
  writeLastSync,
} from "./store.ts";

// Reconcile (mirror rules 2, 4, 6 and 7; SF-ADR-004). Connect runs it with cause "connect" and
// rewrites the whole index; the Reconcile command runs it with cause "command", announces what it
// applied, and touches only what changed.

export interface Counts {
  pushed: number;
  applied: number;
  dropped: number;
}

type Cause = "connect" | "command";
type Deferred = () => Promise<void>;

const splitKey = (key: string): [string, string] => {
  const slash = key.indexOf("/");
  return [key.slice(0, slash), key.slice(slash + 1)];
};

/** Fields whose value differs from `before` (absent before counts as changed). */
function diff(after: Fields, before: Fields | undefined): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(after)) if (before?.[k] !== v) out[k] = v;
  return out;
}

/** Apply a merge-type pending operation to a base set of fields. */
export function applyOp(base: Fields, op: PendingOp): Fields {
  const out = { ...base };
  switch (op.op) {
    case "create":
    case "replace":
      return { ...op.fields };
    case "update":
      return { ...out, ...op.fields };
    case "set_field":
      out[op.field] = op.value;
      return out;
    case "increment":
      out[op.field] = ((out[op.field] as number | undefined) ?? 0) + op.by;
      return out;
    case "delete_field":
      return without(out, op.field);
    case "delete":
      return {};
  }
}

/** Send one operation to Firebase in the shape the server merges (rule 4). */
export async function pushOp(path: string, op: PendingOp, doc: StoredDoc): Promise<void> {
  const { db } = host().ports;
  const stamp = { _t: doc.t, _d: doc.d };
  switch (op.op) {
    case "create":
    case "replace":
      return db.set(path, toWire(doc));
    case "update":
      return db.update(path, { ...op.fields, ...stamp });
    case "set_field":
      return db.update(path, { [op.field]: op.value, ...stamp });
    case "increment":
      return db.increment(path, op.field, op.by, stamp);
    case "delete_field":
      return db.update(path, { [op.field]: null, ...stamp });
    case "delete":
      return db.remove(path);
  }
}

/**
 * Rule 7: documents edited in the ini while the Bridge was closed. A document whose text no longer
 * matches its recorded hash, and which is valid, is queued as a replace stamped now: local wins.
 */
export async function catchUpIniEdits(): Promise<Set<string>> {
  const { ports, state } = host();
  const queued = new Set<string>();
  for (const [collection, docs] of state.mirror) {
    for (const [id, doc] of docs) {
      const key = docKey(collection, id);
      const recorded = state.hashes.get(key);
      const text = state.raw.get(key);
      if (recorded === undefined || text === undefined || crc32(text) === recorded) continue;
      if (state.pending.has(key)) continue;
      await putPending(collection, id, { op: "replace", fields: { ...doc.fields }, at: ports.now() });
      queued.add(key);
    }
  }
  return queued;
}

export async function reconcile(cause: Cause, iniEdits: Set<string> = new Set()): Promise<Counts> {
  const { ports, state } = host();
  const uid = state.uid as string;
  const counts: Counts = { pushed: 0, applied: 0, dropped: 0 };
  const touched = new Set<string>();
  const events: Deferred[] = [];
  const index = cause === "command";

  // Schema first, newest wins (H1).
  const schemaTree = ((await ports.db.read(userPath(uid, "meta/schema"))) ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const [name, entry] of Object.entries(schemaTree)) {
    const t = entry._t as number;
    const local = state.schema.get(name);
    if (local && local.t >= t) continue;
    await putSchema(name, {
      fields: entry.fields as string[],
      strict: entry.strict as boolean,
      twoWay: entry.two_way as boolean,
      t,
    });
  }

  // Documents (rules 2 and 3); a key with a pending operation is decided by the replay below.
  const tree = ((await ports.db.read(userPath(uid, "collections"))) ?? {}) as Record<string, Record<string, unknown>>;
  const remote = new Map<string, StoredDoc>();
  for (const [collection, docs] of Object.entries(tree)) {
    for (const [id, wire] of Object.entries(docs)) {
      const doc = fromWire(wire);
      if (!doc) continue;
      const key = docKey(collection, id);
      remote.set(key, doc);
      if (state.pending.has(key)) continue;
      const local = getDoc(collection, id);
      if (local && !remoteWins(doc, local)) continue;
      await putDoc(collection, id, doc, { index });
      counts.applied++;
      touched.add(collection);
      if (cause === "command") events.push(() => announceRemote(collection, id, doc, local));
    }
  }

  // Pending operations (rule 4).
  for (const [key, op] of [...state.pending]) {
    const [collection, id] = splitKey(key);
    const path = userPath(uid, `collections/${collection}/${id}`);
    const theirs = remote.get(key);
    const ours = getDoc(collection, id);
    if ((op.op === "create" || op.op === "replace") && theirs && theirs.t > op.at) {
      await clearPending(collection, id);
      await putDoc(collection, id, theirs, { index });
      counts.applied++;
      counts.dropped++;
      touched.add(collection);
      // The live listener may already have applied and announced this version.
      if (ours?.t !== theirs.t || ours.d !== theirs.d) {
        events.push(() => announceRemote(collection, id, theirs, ours, "DocumentUpdated"));
      }
      continue;
    }
    if (op.op !== "create" && op.op !== "replace" && theirs && (!ours || theirs.t > ours.t)) {
      counts.applied++;
      if (cause === "command") events.push(() => announceRemote(collection, id, theirs, ours));
    }
    const merged: StoredDoc = {
      fields: applyOp(theirs?.fields ?? ours?.fields ?? {}, op),
      t: ports.now(),
      d: state.deviceId,
    };
    await pushOp(path, op, merged);
    counts.pushed++;
    await clearPending(collection, id);
    if (op.op !== "delete") await putDoc(collection, id, merged, { index });
    touched.add(collection);
    if (iniEdits.has(key)) {
      events.push(() =>
        emit(theirs ? "DocumentReplaced" : "DocumentCreated", {
          collection,
          id,
          fields: fieldsText(merged.fields),
          ...(theirs ? { previous: fieldsText(theirs.fields) } : {}),
        }),
      );
    }
  }

  if (cause === "connect") {
    await writeCollections();
    for (const collection of [...state.mirror.keys()].sort()) await writeIds(collection);
    await writeHashes();
  } else if (touched.size > 0) {
    await writeHashes();
  }
  await writeLastSync();

  const publishSet = cause === "connect" ? [...state.mirror.keys()] : [...touched];
  for (const collection of publishSet.sort()) await publish(collection);
  for (const event of events) await event();
  return counts;
}

async function announceRemote(
  collection: string,
  id: string,
  doc: StoredDoc,
  before: StoredDoc | undefined,
  type: "DocumentUpdated" | "DocumentCreated" = before ? "DocumentUpdated" : "DocumentCreated",
): Promise<void> {
  const fields = { collection, id, fields: fieldsText(doc.fields) };
  await emit(
    type,
    type === "DocumentCreated"
      ? fields
      : {
          ...fields,
          previous: fieldsText(before?.fields ?? {}),
          changed: fieldsText(diff(doc.fields, before?.fields)),
        },
    { source: "remote", deviceId: doc.d },
  );
}
