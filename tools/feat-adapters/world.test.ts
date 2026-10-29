import { beforeEach, describe, expect, it } from "vitest";
import { world } from "./world.ts";

// H2 (docs/09): the fake behaves like the real surface. Each case names the fact it rests on.
// The gateway probe's recorded fixture (T-D2, evidence/pc/gateway-probe.json) is asserted here
// once it exists; until then the cases cite the verified sources in docs/02.

const w = world("2026-10-29T12:00:00Z");
const p = () => w.ports();
const config = {
  apiKey: "AIzaSyProbeKey00000000000000000000000",
  authDomain: "x.firebaseapp.com",
  projectId: "x",
  appId: "1:1:web:a",
  databaseURL: "https://x.firebaseio.com",
};

beforeEach(() => w.reset());

describe("ini (S10: SAMMI.saveIni / loadIni, one key at a time, text values)", () => {
  it("reads back what was written, as text", async () => {
    await p().ini.write("s", "k", "42");
    expect(await p().ini.read("s", "k")).toBe("42");
  });
  it("an absent key reads as undefined", async () => {
    expect(await p().ini.read("s", "missing")).toBeUndefined();
  });
  it("a removed key reads as absent", async () => {
    await p().ini.write("s", "k", "v");
    await p().ini.remove("s", "k");
    expect(await p().ini.read("s", "k")).toBeUndefined();
  });
  it("records a write with its parsed JSON and a plain value without", async () => {
    await p().ini.write("s", "j", '{"a":1}');
    await p().ini.write("s", "t", "plain");
    expect(w.log.ini.map((r) => r.payload)).toEqual([
      { section: "s", key: "j", value: '{"a":1}', json: { a: 1 } },
      { section: "s", key: "t", value: "plain" },
    ]);
  });
});

describe("Realtime Database (F7, verified Oct 29, 2026, and the SDK's documented semantics)", () => {
  it("returns children ordered by key", async () => {
    w.dbSet("r/b", 1);
    w.dbSet("r/a", 2);
    expect(Object.keys((await p().db.read("r")) as object)).toEqual(["a", "b"]);
  });
  it("update with null removes the field and leaves the others", async () => {
    w.dbSet("d", { a: 1, b: 2 });
    await p().db.update("d", { a: null, c: 3 });
    expect(await p().db.read("d")).toEqual({ b: 2, c: 3 });
  });
  it("increment of an absent field starts from 0", async () => {
    await p().db.increment("d", "n", 5);
    expect(await p().db.read("d")).toEqual({ n: 5 });
  });
  it("set replaces, remove deletes, and reading an absent path is undefined", async () => {
    await p().db.set("d", { a: 1 });
    await p().db.set("d", { b: 2 });
    expect(await p().db.read("d")).toEqual({ b: 2 });
    await p().db.remove("d");
    expect(await p().db.read("d")).toBeUndefined();
    await p().db.remove("never/there");
    expect(await p().db.read("x/y/z")).toBeUndefined();
  });
  it("reads are copies: mutating a result does not change the database", async () => {
    w.dbSet("d", { a: 1 });
    const got = (await p().db.read("d")) as { a: number };
    got.a = 99;
    expect(await p().db.read("d")).toEqual({ a: 1 });
  });
  it("a later write lands after the first full read of collections, not before", async () => {
    w.later.push({ path: "users/u/collections/c/d", value: { n: 2 } });
    expect(await p().db.read("users/u/collections")).toBeUndefined();
    expect(await p().db.read("users/u/collections")).toEqual({ c: { d: { n: 2 } } });
  });
  it("an outage fails the next document writes and nothing else", async () => {
    w.outage = 1;
    await p().db.update("users/u/meta/devices/x", { lastSeen: 1 });
    await expect(p().db.set("users/u/collections/c/d", { n: 1 })).rejects.toThrow(/fake outage/);
    await p().db.set("users/u/collections/c/d", { n: 1 });
    expect(w.outage).toBe(0);
  });
});

describe("Firebase Authentication (F2, F1, D4: Email/Password only)", () => {
  beforeEach(() => w.users.push({ email: "a@b.c", password: "pw", uid: "u1" }));
  it("signs in with the right password and issues a session record", async () => {
    expect(await p().auth.signIn(config, "a@b.c", "pw")).toEqual({
      ok: true,
      uid: "u1",
      email: "a@b.c",
      record: "opaque-sdk-record-for-u1",
    });
  });
  it("refuses a wrong password", async () => {
    expect(await p().auth.signIn(config, "a@b.c", "nope")).toEqual({ ok: false, reason: "credentials invalid" });
  });
  it("resumes from the record it issued and refuses one it did not", async () => {
    expect(await p().auth.resume(config, "opaque-sdk-record-for-u1")).toMatchObject({ ok: true, uid: "u1" });
    expect(await p().auth.resume(config, "opaque-sdk-record-for-ghost")).toEqual({ ok: false, reason: "session lost" });
  });
  it("refuses when the provider is disabled or the API key belongs to no such project", async () => {
    w.projects.push({ apiKey: "other", projectId: "x" });
    expect(await p().auth.resume(config, "opaque-sdk-record-for-u1")).toEqual({ ok: false, reason: "api key invalid" });
    w.providerEnabled = false;
    expect(await p().auth.signIn(config, "a@b.c", "pw")).toEqual({ ok: false, reason: "provider disabled" });
    await p().auth.signOut();
  });
});

describe("SAMMI (S16: setVariable with an object yields an object variable)", () => {
  it("keeps a copy of the object and records the write", async () => {
    const value = { d: { n: 1 } };
    await p().sammi.setVariable("fb_c", value);
    value.d.n = 2;
    expect(w.variables.get("fb_c")).toEqual({ d: { n: 1 } });
    expect(w.log.sammi[0]).toMatchObject({ type: "SetVariable", key: "fb_c" });
  });
  it("records a trigger with its pull data", async () => {
    await p().sammi.trigger("Firebase: Connected", { a: 1 });
    expect(w.log.sammi[0]).toMatchObject({
      type: "Trigger",
      payload: { name: "Firebase: Connected", pullData: { a: 1 } },
    });
  });
});

describe("ports", () => {
  it("the clock is frozen, ids are uuids and push ids are 20 url-safe characters", () => {
    expect(p().now()).toBe(Date.parse("2026-10-29T12:00:00Z"));
    expect(p().uuid()).toMatch(/^[0-9a-f-]{36}$/);
    expect(p().pushId()).toMatch(/^[A-Za-z0-9_-]{20}$/);
  });
});
