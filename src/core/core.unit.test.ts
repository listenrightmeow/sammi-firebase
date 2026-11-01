import { beforeEach, describe, expect, it } from "vitest";
import { world } from "../../tools/feat-adapters/world.ts";
import { Refusal, fail, ok } from "./answers.ts";
import { byteSize, fromWire, parseDocText, remoteWins, sameFields } from "./docs.ts";
import { boxValue, parseFieldsBox } from "./document.ts";
import { host, installHost } from "./host.ts";
import { select } from "./query.ts";
import { run } from "./run.ts";
import { boot, publish, writeIds } from "./store.ts";
import type { StoredDoc } from "./state.ts";
import { applyOp, catchUpIniEdits, pushOp, reconcile } from "./sync.ts";
import { crc32 } from "./crc32.ts";

// The core's utility and defensive paths, run against the fake world. Behavior a streamer can see
// is asserted by the Feature specs; these cases cover what the specs cannot reach.

const w = world("2026-10-29T12:00:00Z");
const T = Date.parse("2026-10-29T12:00:00Z");
const refusal = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return (e as Refusal).message;
  }
  return "no refusal";
};

beforeEach(() => w.reset());

describe("documents", () => {
  it("parses only objects whose fields are strings or numbers with a numeric _t and string _d", () => {
    expect(fromWire({ a: 1, _t: 5, _d: "x" })).toEqual({ fields: { a: 1 }, t: 5, d: "x" });
    for (const bad of [null, [1], "s", { _t: "5" }, { _d: 1 }, { a: true }, { a: { b: 1 } }])
      expect(fromWire(bad)).toBeUndefined();
    expect(parseDocText("{not json")).toBeUndefined();
    expect(byteSize("é")).toBe(4);
  });
  it("crc32 is the IEEE checksum", () => {
    expect(crc32("123456789")).toBe("cbf43926");
  });
  it("the fields box must be a JSON object of strings and numbers", () => {
    expect(parseFieldsBox('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
    expect(refusal(() => parseFieldsBox(undefined))).toBe("bad field");
  });
  it("box values: numbers stay numbers, numeric text becomes a number, str: forces a string", () => {
    expect(boxValue(3)).toBe(3);
    expect(boxValue("-2.5")).toBe(-2.5);
    expect(boxValue("007")).toBe("007");
    expect(boxValue("str:12")).toBe("12");
  });
});

describe("answers and the run edge", () => {
  it("shapes answers", () => {
    expect(ok({ answer: "ok" })).toEqual({ status: "OK", body: { answer: "ok" } });
    expect(fail("not two-way", "example")).toEqual({
      status: "ERR",
      body: { code: "NOT_TWO_WAY", answer: "error: not two-way example" },
    });
  });
  it("a refusal becomes its answer; any other error propagates", async () => {
    await expect(run(async () => Promise.reject(new Refusal("missing", "c/i")))).resolves.toMatchObject({
      status: "ERR",
    });
    await expect(run(async () => Promise.reject(new Error("bug")))).rejects.toThrow("bug");
  });
  it("using the core before a host is installed is a configuration error", () => {
    const slot = globalThis as Record<symbol, unknown>;
    const key = Symbol.for("sammi-firebase.host");
    const saved = slot[key];
    Reflect.deleteProperty(slot, key);
    expect(() => host()).toThrow(/not installed/);
    slot[key] = saved;
  });
});

describe("boot", () => {
  it("reads last sync, schema and documents, skipping ids with no stored text", async () => {
    w.iniSet("connection", "device_id", "dev1");
    w.iniSet("index", "last_sync", "123");
    w.iniSet("index", "collections", '["example","empty"]');
    w.iniSet("index", "example", '["a","gone"]');
    w.iniSet("schema", "example", '{"fields":["ip"],"strict":true,"two_way":false,"_t":7}');
    w.iniSet("collection:example", "a", '{"ip":"1","_t":1,"_d":"x"}');
    await boot();
    await boot();
    const { state } = host();
    expect(state.lastSync).toBe(123);
    expect(state.schema.get("example")).toEqual({ fields: ["ip"], strict: true, twoWay: false, t: 7 });
    expect([...(state.mirror.get("example")?.keys() ?? [])]).toEqual(["a"]);
    expect(state.mirror.get("empty")?.size).toBe(0);
  });
  it("an index entry that is not JSON reads as empty", async () => {
    w.iniSet("index", "collections", "[oops");
    await boot();
    expect(host().state.mirror.size).toBe(0);
  });
  it("a missing or malformed last sync is absent; an unknown collection publishes and indexes as empty", async () => {
    w.iniSet("index", "last_sync", "soon");
    await boot();
    expect(host().state.lastSync).toBeUndefined();
    await publish("ghost");
    await writeIds("ghost");
    expect(w.variables.get("fb_ghost")).toEqual({});
    expect(w.ini.get("index")?.get("ghost")).toBe("[]");
  });
});

describe("queries", () => {
  beforeEach(() => {
    const docs = new Map<string, StoredDoc>([
      ["b", { fields: { n: 10, s: "Beta" }, t: 1, d: "x" }],
      ["a", { fields: { n: 2, s: "alpha" }, t: 1, d: "x" }],
      ["c", { fields: { s: "gamma" }, t: 1, d: "x" }],
    ]);
    host().state.mirror.set("q", docs);
  });
  const ids = (input: Parameters<typeof select>[0]): string[] =>
    select({ collection: "q", ...input }).map((r) => String(r.id));
  it("compares numbers numerically, including numeric text on either side", () => {
    expect(ids({ field: "n", operator: ">", value: "3" })).toEqual(["b"]);
    expect(ids({ field: "n", operator: "<=", value: 2 })).toEqual(["a"]);
    expect(ids({ field: "s", operator: "==", value: "alpha" })).toEqual(["a"]);
    expect(ids({ field: "s", operator: "contains", value: "ET" })).toEqual(["b"]);
  });
  it("an == filter with no value matches empty text only", () => {
    expect(ids({ field: "s", operator: "==" })).toEqual([]);
  });
  it("a filter field with no operator is refused", () => {
    expect(refusal(() => select({ collection: "q", field: "n" }))).toBe("bad operator undefined");
  });
  it("orders numbers before missing values and breaks ties by id", () => {
    expect(ids({ orderBy: "n" })).toEqual(["a", "b", "c"]);
    expect(ids({ orderBy: "n", descending: true })).toEqual(["b", "a", "c"]);
    host()
      .state.mirror.get("q")
      ?.set("d", { fields: { n: 2 }, t: 1, d: "x" });
    expect(ids({ orderBy: "n", limit: 2 })).toEqual(["a", "d"]);
    expect(ids({ orderBy: "s" })).toEqual(["b", "a", "c", "d"]);
  });
});

describe("operations (rule 4)", () => {
  it("applies every pending operation to a base document", () => {
    const base = { a: 1, b: "x" };
    expect(applyOp(base, { op: "create", fields: { c: 1 }, at: 0 })).toEqual({ c: 1 });
    expect(applyOp(base, { op: "update", fields: { a: 2 }, at: 0 })).toEqual({ a: 2, b: "x" });
    expect(applyOp(base, { op: "set_field", field: "b", value: "y", at: 0 })).toEqual({ a: 1, b: "y" });
    expect(applyOp(base, { op: "increment", field: "a", by: 2, at: 0 })).toEqual({ a: 3, b: "x" });
    expect(applyOp(base, { op: "increment", field: "z", by: 2, at: 0 })).toEqual({ a: 1, b: "x", z: 2 });
    expect(applyOp(base, { op: "delete_field", field: "b", at: 0 })).toEqual({ a: 1 });
    expect(applyOp(base, { op: "delete", at: 0 })).toEqual({});
  });
  it("sends each operation in the shape the server merges", async () => {
    const doc = { fields: { a: 1 }, t: 9, d: "dev1" };
    await pushOp("p", { op: "create", fields: { a: 1 }, at: 0 }, doc);
    await pushOp("p", { op: "update", fields: { a: 1 }, at: 0 }, doc);
    await pushOp("p", { op: "delete_field", field: "b", at: 0 }, doc);
    await pushOp("p", { op: "delete", at: 0 }, doc);
    expect(w.log.firebase.map((r) => [r.type, r.payload])).toEqual([
      ["set", { path: "p", value: { a: 1, _t: 9, _d: "dev1" } }],
      ["update", { path: "p", fields: { a: 1, _t: 9, _d: "dev1" } }],
      ["update", { path: "p", fields: { b: null, _t: 9, _d: "dev1" } }],
      ["remove", { path: "p" }],
    ]);
  });
});

describe("reconcile edges", () => {
  const connect = async (): Promise<void> => {
    w.users.push({ email: "a@b.c", password: "pw", uid: "u" });
    await boot();
    Object.assign(host().state, { connected: true, uid: "u", deviceId: "dev1" });
  };
  it("keeps a local schema newer than the cloud's and skips a malformed cloud document", async () => {
    await connect();
    host().state.schema.set("example", { fields: [], strict: false, twoWay: true, t: 50 });
    w.dbSet("users/u/meta/schema/example", { fields: ["x"], strict: true, two_way: true, _t: 10 });
    w.dbSet("users/u/collections/example/bad", { a: { nested: 1 } });
    const counts = await reconcile("command");
    expect(host().state.schema.get("example")?.t).toBe(50);
    expect(counts).toEqual({ pushed: 0, applied: 0, dropped: 0 });
  });
  it("announces a document new from the cloud as created, on command", async () => {
    await connect();
    w.dbSet("users/u/collections/example/new", { a: 1, _t: 5, _d: "dev2" });
    await reconcile("command");
    expect(w.log.sammi.at(-1)?.payload).toMatchObject({
      name: "Firebase: Document Created",
      pullData: { source: "remote", deviceId: "dev2" },
    });
  });
  it("on connect a newer cloud document under a pending merge counts as applied but is not announced", async () => {
    await connect();
    host().state.mirror.set("c", new Map([["d", { fields: { n: 1 }, t: 1, d: "dev1" }]]));
    host().state.pending.set("c/d", { op: "set_field", field: "n", value: 2, at: 1 });
    w.dbSet("users/u/collections/c/d", { n: 5, _t: 3, _d: "dev2" });
    expect(await reconcile("connect")).toEqual({ pushed: 1, applied: 1, dropped: 0 });
    expect(w.log.sammi.filter((r) => r.type === "Trigger")).toEqual([]);
  });
  it("replays a pending delete and a pending set for a document the cloud never had", async () => {
    await connect();
    host().state.pending.set("c/gone", { op: "delete", at: 1 });
    host().state.pending.set("c/new", { op: "set_field", field: "n", value: 1, at: 1 });
    expect(await reconcile("connect")).toEqual({ pushed: 2, applied: 0, dropped: 0 });
    expect(host().state.mirror.get("c")?.get("new")?.fields).toEqual({ n: 1 });
    expect(host().state.mirror.get("c")?.has("gone")).toBe(false);
  });
  it("an ini edit with no cloud copy is announced as created; one already pending is left to its operation", async () => {
    await connect();
    const { state } = host();
    state.mirror.set(
      "c",
      new Map([
        ["d", { fields: { n: 1 }, t: 1, d: "dev1" }],
        ["p", { fields: { n: 2 }, t: 1, d: "dev1" }],
      ]),
    );
    state.raw.set("c/d", '{"n":1,"_t":1,"_d":"dev1"}');
    state.raw.set("c/p", '{"n":2,"_t":1,"_d":"dev1"}');
    state.hashes.set("c/d", "stale");
    state.hashes.set("c/p", "stale");
    state.pending.set("c/p", { op: "set_field", field: "n", value: 2, at: 1 });
    const edits = await catchUpIniEdits();
    expect([...edits]).toEqual(["c/d"]);
    await reconcile("connect", edits);
    expect(w.log.sammi.find((r) => r.type === "Trigger")?.payload).toMatchObject({
      name: "Firebase: Document Created",
    });
    expect(T).toBeGreaterThan(0);
  });
  it("installing a host replaces the state", () => {
    host().state.connected = true;
    installHost(w.ports());
    expect(host().state.connected).toBe(false);
  });
});

describe("mirror rule 2", () => {
  const doc = (t: number, d: string, fields: Record<string, string | number>) => ({ t, d, fields });
  it("a newer stamp wins and an older one loses, whatever the fields", () => {
    expect(remoteWins(doc(2, "a", { n: 1 }), doc(1, "a", { n: 1 }))).toBe(true);
    expect(remoteWins(doc(1, "a", { n: 2 }), doc(2, "a", { n: 1 }))).toBe(false);
  });
  it("equal stamps win only when the fields differ, an edit made outside the extension", () => {
    expect(remoteWins(doc(1, "a", { n: 2 }), doc(1, "a", { n: 1 }))).toBe(true);
    expect(remoteWins(doc(1, "a", { n: 1, m: 2 }), doc(1, "a", { n: 1 }))).toBe(true);
    expect(remoteWins(doc(1, "a", { n: 1 }), doc(1, "a", { n: 1, m: 2 }))).toBe(true);
    expect(remoteWins(doc(1, "a", { n: 1 }), doc(1, "a", { n: 1 }))).toBe(false);
  });
  it("an equal timestamp from another device keeps local", () => {
    expect(remoteWins(doc(1, "b", { n: 2 }), doc(1, "a", { n: 1 }))).toBe(false);
  });
  it("compares fields regardless of key order", () => {
    expect(sameFields({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameFields({ a: 1 }, { a: "1" })).toBe(false);
  });
});
