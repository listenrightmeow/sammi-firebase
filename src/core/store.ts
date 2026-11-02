import { host } from "./host.ts";
import { crc32 } from "./crc32.ts";
import { byteSize, docText, parseDocText, type Fields } from "./docs.ts";
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

/**
 * The most a single message to SAMMI may carry (D32). SAMMI publishes no number and drops what is too
 * large (S12). T-V3 stopped at about 41 KB, and a document is at most 8 KB, so this leaves room for both.
 */
export const MESSAGE_MAX = 16000;
/** What a dotted variable path can reach: SAMMI's dot notation does not take dashes or spaces. */
export const DOTTED_ID = /^[A-Za-z0-9_]+$/;

export const overMessage = (value: unknown): boolean => byteSize(value) > MESSAGE_MAX;

/** An answer too large for one message is refused, so it cannot vanish in the websocket. */
export const withinMessage = (answer: string): string => (overMessage(answer) ? "error: too large" : answer);

const partKey = (key: string, part: number): string => (part === 0 ? key : `${key}__part${part}`);

/** One ini value across as many keys as it needs. Only a part filled to the cap has a next part. */
export async function readChain(section: string, key: string): Promise<string | undefined> {
  const { ports, state } = host();
  const parts: string[] = [];
  for (;;) {
    const part = await ports.ini.read(section, partKey(key, parts.length));
    if (!part) break;
    parts.push(part);
    if (part.length < MESSAGE_MAX) break;
  }
  state.iniChains.set(`${section}/${key}`, parts);
  return parts.length ? parts.join("") : undefined;
}

/** Write a value across its parts, sending only the parts that changed. */
export async function writeChain(section: string, key: string, text: string): Promise<void> {
  const { ports, state } = host();
  const id = `${section}/${key}`;
  const before = state.iniChains.get(id) ?? [];
  const parts: string[] = [];
  for (let at = 0; at === 0 || at < text.length; at += MESSAGE_MAX) parts.push(text.slice(at, at + MESSAGE_MAX));
  state.iniChains.set(id, parts);
  if (parts.length === 1 && before.length <= 1) return ports.ini.write(section, key, text);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== before[i]) await ports.ini.write(section, partKey(key, i), parts[i] as string);
  }
  for (let i = parts.length; i < before.length; i++) await ports.ini.write(section, partKey(key, i), "");
}

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
  state.hashes = new Map(Object.entries(parse<Record<string, string>>(await readChain("index", "hashes")) ?? {}));
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
    for (const id of parse<string[]>(await readChain("index", collection)) ?? []) {
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
  const ids = [...(host().state.mirror.get(collection)?.keys() ?? [])].sort();
  await writeChain("index", collection, JSON.stringify(ids));
}

export async function writeHashes(): Promise<void> {
  await writeChain("index", "hashes", JSON.stringify(Object.fromEntries(host().state.hashes)));
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
  const before = state.published.get(collection);
  state.published.set(collection, value);
  state.publishes++;
  const name = `fb_${collection}`;
  if (!overMessage(value)) {
    state.unreachable.delete(collection);
    return ports.sammi.setVariable(name, value);
  }
  state.publishing++;
  try {
    await publishLarge(collection, name, value, before);
  } finally {
    state.publishing--;
  }
}

/** D32: a collection over one message goes as a chain the first time, then only what changed. */
async function publishLarge(
  collection: string,
  name: string,
  value: Record<string, Fields>,
  before: Record<string, Fields> | undefined,
): Promise<void> {
  const { ports, state } = host();
  let rest = Object.keys(value);
  if (before) {
    rest = rest.filter((id) => JSON.stringify(before[id]) !== JSON.stringify(value[id]));
  } else {
    const first: Record<string, Fields> = {};
    let size = 2;
    while (rest.length) {
      const id = rest[0] as string;
      size += byteSize({ [id]: value[id] });
      if (size > MESSAGE_MAX) break;
      first[id] = value[id] as Fields;
      rest.shift();
    }
    await ports.sammi.setVariable(name, first);
  }
  const unreachable = new Set(state.unreachable.get(collection));
  for (const id of rest) {
    if (!DOTTED_ID.test(id)) unreachable.add(id);
    else await ports.sammi.setVariable(`${name}.${id}`, value[id]);
  }
  for (const id of Object.keys(before ?? {})) {
    if (id in value) continue;
    unreachable.delete(id);
    if (DOTTED_ID.test(id)) await ports.sammi.setVariable(`${name}.${id}`, null);
  }
  state.unreachable.set(collection, [...unreachable]);
}

export function documentCount(): number {
  let n = 0;
  for (const docs of host().state.mirror.values()) n += docs.size;
  return n;
}

export const userPath = (uid: string, rest: string): string => `users/${uid}/${rest}`;
