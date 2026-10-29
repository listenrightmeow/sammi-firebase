import { serviceAdapterContract } from "@mmmnt/feat-adapter-kit";
import { describe, expect, it } from "vitest";
import { createAdapter as ini } from "./ini/index.ts";
import { createAdapter as firebase } from "./firebase/index.ts";
import { createAdapter as sammi } from "./sammi/index.ts";
import { world } from "./world.ts";

// H1 (docs/09): each adapter meets the Feature service-adapter contract the runtime relies on.

const options = { options: { clock: "2026-10-29T12:00:00Z" } };

serviceAdapterContract("ini", {
  factory: () => ini(options),
  act: async () => world().ports().ini.write("connection", "email", "a@b.c"),
  seedRecords: [{ type: "IniWrite", values: { section: "connection", key: "email", value: "a@b.c" } }],
});

serviceAdapterContract("firebase", {
  factory: () => firebase(options),
  act: async () => world().ports().db.set("users/u/collections/c/d", { n: 1, _t: 1, _d: "x" }),
  seedRecords: [{ type: "node", values: { path: "users/u/collections/c/d", value: { n: 1 } } }],
});

serviceAdapterContract("sammi", {
  factory: () => sammi(options),
  act: async () =>
    world()
      .ports()
      .sammi.setVariable("fb_c", { d: { n: 1 } }),
});

describe("adapter vocabularies", () => {
  it("ini seeds a json value as JSON text and reads it back as a record with json", async () => {
    const a = ini(options);
    await a.reset();
    await a.seed([{ type: "IniWrite", values: { section: "index", key: "collections", json: ["a"] } }]);
    expect(await a.read()).toEqual([
      expect.objectContaining({
        type: "IniWrite",
        payload: { section: "index", key: "collections", value: '["a"]', json: ["a"] },
      }),
    ]);
  });

  it("ini refuses a seed record it does not know", async () => {
    await expect(ini(options).seed([{ type: "node", values: {} }])).rejects.toThrow(/configuration error/);
  });

  it("firebase seeds users, a disabled provider, a project key, later writes and an outage", async () => {
    const a = firebase(options);
    await a.reset();
    await a.seed([
      { type: "user", values: { email: "a@b.c", password: "pw", uid: "u1" } },
      { type: "provider", values: { name: "password", enabled: false } },
      { type: "project", values: { apiKey: "k", projectId: "p" } },
      { type: "later", values: { path: "users/u1/collections/c/d", value: { n: 2 } } },
      { type: "outage", values: { writes: 2 } },
    ]);
    const w = world();
    expect(w.users).toEqual([{ email: "a@b.c", password: "pw", uid: "u1" }]);
    expect(w.providerEnabled).toBe(false);
    expect(w.projects).toEqual([{ apiKey: "k", projectId: "p" }]);
    expect(w.later).toHaveLength(1);
    expect(w.outage).toBe(2);
    expect(await a.read()).toEqual([expect.objectContaining({ type: "node", payload: { path: "", value: {} } })]);
    await expect(a.seed([{ type: "IniWrite", values: {} }])).rejects.toThrow(/configuration error/);
  });

  it("sammi has no state to read", async () => {
    expect(await sammi(options).read()).toBeNull();
  });

  it("a world clock that is not a timestamp is a configuration error", async () => {
    const { World } = await import("./world.ts");
    expect(() => new World("not a date")).toThrow(/configuration error/);
    expect(new World(undefined).now).toBeGreaterThan(0);
  });
});
