import { beforeEach, describe, expect, it } from "vitest";
import { world } from "../../tools/feat-adapters/world.ts";
import { host, installHost } from "./host.ts";
import { pollVariables } from "./poll.ts";
import * as applyVariableChange from "../features/apply-variable-change/handler.ts";
import * as incrementField from "../features/increment-field/handler.ts";
import { boot, publish } from "./store.ts";

type Change = { collection: string; id: string; field: string; value: unknown };

describe("pollVariables", () => {
  let changes: Change[];
  const apply = async (c: Change) => void changes.push(c);
  beforeEach(async () => {
    changes = [];
    installHost(world().ports());
    const { state } = host();
    state.connected = true;
    state.mirror.set("test", new Map([["a", { fields: { n: 1, s: "x" }, t: 1, d: "dev1" }]]));
    await publish("test");
  });

  it("writes a changed field, a new field and a removed field", async () => {
    await pollVariables(async () => ({ a: { n: 2, m: 3 } }), apply);
    expect(changes).toEqual([
      { collection: "test", id: "a", field: "n", value: 2 },
      { collection: "test", id: "a", field: "m", value: 3 },
      { collection: "test", id: "a", field: "s", value: null },
    ]);
  });
  it("writes nothing when the variable matches the mirror", async () => {
    await pollVariables(async () => ({ a: { n: 1, s: "x" } }), apply);
    expect(changes).toEqual([]);
  });
  it("drops a reply read while a write rewrote the variable, so the write is not undone", async () => {
    await pollVariables(async () => {
      const doc = host().state.mirror.get("test")?.get("a");
      if (doc) doc.fields = { n: 2, s: "x" };
      await publish("test");
      return { a: { n: 1, s: "x" } };
    }, apply);
    expect(changes).toEqual([]);
  });
  it("keeps applying its own changes, each of which rewrites the variable", async () => {
    const publishing = async (c: Change) => {
      changes.push(c);
      await publish(c.collection);
    };
    await pollVariables(async () => ({ a: { n: 2, s: "y" } }), publishing);
    expect(changes.map((c) => c.field)).toEqual(["n", "s"]);
  });
  it("writes each field of a document it has not published, and ignores an empty entry", async () => {
    await pollVariables(async () => ({ a: { n: 1, s: "x" }, b: { n: 5 }, c: null }), apply);
    expect(changes).toEqual([{ collection: "test", id: "b", field: "n", value: 5 }]);
  });
  it("drops a stale reply that lacks a field, so the field is not removed", async () => {
    await pollVariables(async () => {
      await publish("test");
      return { a: { n: 1 } };
    }, apply);
    expect(changes).toEqual([]);
  });
  it("skips a collection that is not two-way, an absent variable, and a closed connection", async () => {
    host().state.schema.set("test", { fields: [], strict: false, twoWay: false, t: 1 });
    await pollVariables(async () => ({ a: { n: 2 } }), apply);
    host().state.schema.clear();
    await pollVariables(async () => undefined, apply);
    await pollVariables(async () => "not an object", apply);
    host().state.connected = false;
    await pollVariables(async () => ({ a: { n: 2 } }), apply);
    expect(changes).toEqual([]);
  });
  it("does not overlap a poll still waiting on its read", async () => {
    let finish: (v: unknown) => void = () => undefined;
    const slow = pollVariables(() => new Promise((r) => (finish = r)), apply);
    await pollVariables(async () => ({ a: { n: 9 } }), apply);
    expect(changes).toEqual([]);
    finish({ a: { n: 2, s: "x" } });
    await slow;
    expect(changes).toEqual([{ collection: "test", id: "a", field: "n", value: 2 }]);
  });
});

describe("pollVariables during a command", () => {
  it("does not undo an increment when a poll lands between the mirror update and the variable rewrite", async () => {
    const w = world();
    const ports = w.ports();
    const applied: Change[] = [];
    let polled = 0;
    const write = ports.ini.write;
    ports.ini.write = async (section, key, value) => {
      await write(section, key, value);
      if (section === "pending" && polled === 0) {
        polled++;
        await pollVariables(
          async (name) => w.variables.get(name),
          async (c) => {
            applied.push(c);
            await applyVariableChange.handle(c);
          },
        );
      }
    };
    installHost(ports);
    await boot();
    Object.assign(host().state, { connected: true, uid: "u", deviceId: "dev1" });
    host().state.mirror.set("test", new Map([["count", { fields: { n: 0 }, t: 1, d: "dev1" }]]));
    await publish("test");

    const res = await incrementField.handle({ collection: "test", id: "count", field: "n", by: "1" });

    expect(res.status).toBe("OK");
    expect(polled).toBe(1);
    expect(applied).toEqual([]);
    expect(host().state.mirror.get("test")?.get("count")?.fields.n).toBe(1);
    expect(w.variables.get("fb_test")).toEqual({ count: { n: 1 } });
  });
});
