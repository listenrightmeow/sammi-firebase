import { host } from "./host.ts";
import { crc32 } from "./crc32.ts";
import { docText, parseDocText, type Fields } from "./docs.ts";
import { docKey } from "./names.ts";
import type { FirebaseConfig } from "./ports.ts";
import type { PendingOp, SchemaEntry, StoredDoc } from "./state.ts";

// The local mirror: memory plus firebase.ini (SF-ADR-004, contracts/ini-firebase.json). Every
// write goes to memory and the ini together; the ini is what survives the Bridge.

const parse = <T>(text: string | undefined): T | undefined => {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
};

const DEVICE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Load the mirror from firebase.ini once per Bridge session. Reads only; never writes. */
export async function boot(): Promise<void> {
  const { ports, state } = host();
  if (state.booted) return;
  const ini = ports.ini;
  state.config = parse<FirebaseConfig>(await ini.read("connection", "config"));
  state.email = await ini.read("connection", "email");
  state.session = await ini.read("connection", "session");
  const device = await ini.read("connection", "device_id");
  if (device) {
    state.deviceId = device;
  } else {
    const id = ports.uuid().replace(/-/g, "");
    state.deviceId = Array.from(id.slice(0, 8), (ch) => DEVICE_CHARS[parseInt(ch, 16) % 36]).join("");
    state.deviceIdNew = true;
  }
  const lastSync = await ini.read("index", "last_sync");
  state.lastSync = lastSync && /^\d+$/.test(lastSync) ? Number(lastSync) : undefined;
  state.hashes = new Map(Object.entries(parse<Record<string, string>>(await ini.read("index", "hashes")) ?? {}));
  for (const collection of parse<string[]>(await ini.read("index", "collections")) ?? []) {
    const docs = new Map<string, StoredDoc>();
    state.mirror.set(collection, docs);
    const schema = parse<{ fields: string[]; strict: boolean; two_way: boolean; _t: number }>(
      await ini.read("schema", collection),
    );
    if (schema) {
      state.schema.set(collection, {
        fields: schema.fields,
        strict: schema.strict,
        twoWay: schema.two_way,
        t: schema._t,
      });
    }
    for (const id of parse<string[]>(await ini.read("index", collection)) ?? []) {
      const key = docKey(collection, id);
      const text = await ini.read(`collection:${collection}`, id);
      if (text === undefined) continue;
      state.raw.set(key, text);
      const doc = parseDocText(text);
      if (doc) docs.set(id, doc);
      else state.invalidIni.push(key);
      const pending = parse<PendingOp>(await ini.read("pending", key));
      if (pending) state.pending.set(key, pending);
    }
  }
  state.booted = true;
}

export function getDoc(collection: string, id: string): StoredDoc | undefined {
  return host().state.mirror.get(collection)?.get(id);
}

/** Write a document to memory and the ini, adding it to the index when it is new. */
export async function putDoc(
  collection: string,
  id: string,
  doc: StoredDoc,
  opts: { index?: boolean } = {},
): Promise<void> {
  const { ports, state } = host();
  let docs = state.mirror.get(collection);
  const newCollection = !docs;
  if (!docs) {
    docs = new Map();
    state.mirror.set(collection, docs);
  }
  const newId = !docs.has(id);
  docs.set(id, doc);
  const text = docText(doc);
  const key = docKey(collection, id);
  state.raw.set(key, text);
  state.hashes.set(key, crc32(text));
  await ports.ini.write(`collection:${collection}`, id, text);
  if (opts.index === false) return;
  if (newCollection) await writeCollections();
  if (newId) await writeIds(collection);
}

/** Remove a document from memory, the ini and the index. */
export async function dropDoc(collection: string, id: string): Promise<void> {
  const { ports, state } = host();
  const key = docKey(collection, id);
  state.mirror.get(collection)?.delete(id);
  state.raw.delete(key);
  state.hashes.delete(key);
  await ports.ini.remove(`collection:${collection}`, id);
  await writeIds(collection);
}

export async function writeCollections(): Promise<void> {
  const { ports, state } = host();
  await ports.ini.write("index", "collections", JSON.stringify([...state.mirror.keys()].sort()));
}

export async function writeIds(collection: string): Promise<void> {
  const { ports, state } = host();
  const ids = [...(state.mirror.get(collection)?.keys() ?? [])].sort();
  await ports.ini.write("index", collection, JSON.stringify(ids));
}

export async function writeHashes(): Promise<void> {
  const { ports, state } = host();
  await ports.ini.write("index", "hashes", JSON.stringify(Object.fromEntries(state.hashes)));
}

export async function writeLastSync(): Promise<void> {
  const { ports, state } = host();
  state.lastSync = ports.now();
  await ports.ini.write("index", "last_sync", String(state.lastSync));
}

export async function putPending(collection: string, id: string, op: PendingOp): Promise<void> {
  const { ports, state } = host();
  const key = docKey(collection, id);
  state.pending.set(key, op);
  await ports.ini.write("pending", key, JSON.stringify(op));
}

export async function clearPending(collection: string, id: string): Promise<void> {
  const { ports, state } = host();
  const key = docKey(collection, id);
  state.pending.delete(key);
  await ports.ini.remove("pending", key);
}

export async function putSchema(name: string, entry: SchemaEntry): Promise<void> {
  const { ports, state } = host();
  state.schema.set(name, entry);
  await ports.ini.write(
    "schema",
    name,
    JSON.stringify({ fields: entry.fields, strict: entry.strict, two_way: entry.twoWay, _t: entry.t }),
  );
}

/** Rewrite fb_<collection> (SF-ADR-007): document ids to fields, without _t and _d. */
export async function publish(collection: string): Promise<void> {
  const { ports, state } = host();
  const value: Record<string, Fields> = {};
  for (const [id, doc] of state.mirror.get(collection) ?? []) value[id] = { ...doc.fields };
  await ports.sammi.setVariable(`fb_${collection}`, value);
}

export function documentCount(): number {
  let n = 0;
  for (const docs of host().state.mirror.values()) n += docs.size;
  return n;
}

export const userPath = (uid: string, rest: string): string => `users/${uid}/${rest}`;
