import { beforeEach, describe, expect, it } from "vitest";
import { world, type World } from "../../tools/feat-adapters/world.ts";
import * as replaceDocument from "../features/replace-document/handler.ts";
import * as setField from "../features/set-field/handler.ts";
import { settleInFlight } from "./document.ts";
import { host, installHost } from "./host.ts";
import { reconcileAfterReconnect } from "./reconnect.ts";
import { boot } from "./store.ts";
import { reconcile } from "./sync.ts";

// Rule 1: the button is answered before the cloud. The real SDK holds a write's promise open while
// the network is down, so nothing here may wait for it (T-O1, T-O3, T-B5).
describe("a write while the network is down", () => {
  let w: World;
  const usePorts = (ports: ReturnType<World["ports"]>) => installHost(ports);
  beforeEach(async () => {
    w = world("2026-10-29T12:00:00Z");
    w.reset();
    const ports = w.ports();
    ports.background = async () => undefined;
    usePorts(ports);
    await boot();
    Object.assign(host().state, { connected: true, uid: "u", deviceId: "dev1" });
  });

  it("answers at once when the connection is known to be down, sends nothing and stays pending", async () => {
    w.online = false;
    const res = await setField.handle({ collection: "test", id: "b", field: "n", value: "2" });
    expect(res.body.answer).toBe("2");
    expect(host().state.pending.has("test/b")).toBe(true);
    expect(w.dbGet("users/u/collections/test/b")).toBeUndefined();
  });
  it("answers at once when a write hangs because the drop is not yet noticed, and clears on the ack", async () => {
    let ack: () => void = () => undefined;
    host().ports.db.set = () => new Promise<void>((r) => (ack = r));
    const res = await setField.handle({ collection: "test", id: "b", field: "n", value: "2" });
    expect(res.body.answer).toBe("2");
    expect(host().state.pending.has("test/b")).toBe(true);
    ack();
    await settleInFlight();
    expect(host().state.pending.has("test/b")).toBe(false);
  });
  it("on reconnect, replays what stayed pending", async () => {
    w.online = false;
    await setField.handle({ collection: "test", id: "b", field: "n", value: "2" });
    w.online = true;
    await settleInFlight();
    await reconcile("command");
    expect(host().state.pending.size).toBe(0);
    expect(w.dbGet("users/u/collections/test/b")).toMatchObject({ n: 2 });
  });
  it("on reconnect, a newer console edit beats an offline replace (rule 4), announced once", async () => {
    w.online = false;
    await replaceDocument.handle({ collection: "test", id: "b", fields: '{"n":3}' });
    w.online = true;
    w.dbSet("users/u/collections/test/b", { n: 99, _t: Date.parse("2026-10-29T13:00:00Z"), _d: "phone" });
    await reconcile("command");
    expect(host().state.mirror.get("test")?.get("b")?.fields).toEqual({ n: 99 });
    expect(host().state.pending.size).toBe(0);
    expect(w.dbGet("users/u/collections/test/b")).toMatchObject({ n: 99 });
    const updated = w.log.sammi.filter((r) => r.payload.name === "Firebase: Document Updated");
    expect(updated).toHaveLength(1);
  });
  it("on reconnect, does not announce a version the live listener already applied", async () => {
    w.online = false;
    await replaceDocument.handle({ collection: "test", id: "b", fields: '{"n":3}' });
    w.online = true;
    const version = { fields: { n: 99 }, t: Date.parse("2026-10-29T13:00:00Z"), d: "phone" };
    w.dbSet("users/u/collections/test/b", { n: 99, _t: version.t, _d: version.d });
    host().state.mirror.get("test")?.set("b", version);
    await reconcile("command");
    expect(host().state.pending.size).toBe(0);
    expect(w.log.sammi.filter((r) => r.payload.name === "Firebase: Document Updated")).toHaveLength(0);
  });
  it("keeps a write pending when the cloud refuses it", async () => {
    host().ports.db.set = () => Promise.reject(new Error("permission denied"));
    const res = await setField.handle({ collection: "test", id: "b", field: "n", value: "2" });
    await settleInFlight();
    expect(res.body.answer).toBe("2");
    expect(host().state.pending.has("test/b")).toBe(true);
  });

  describe("on reconnect, with the SDK answering get() from its cache while a listener is active", () => {
    let listening: boolean;
    let order: string[];
    const steps = (reconcileCommand = () => reconcile("command")) => ({
      stopListening: () => {
        listening = false;
        order.push("stop");
      },
      reconcile: async () => {
        order.push("reconcile");
        await reconcileCommand();
      },
      startListening: async () => {
        listening = true;
        order.push("start");
      },
    });
    beforeEach(() => {
      listening = true;
      order = [];
      const read = host().ports.db.read;
      host().ports.db.read = async (path) => (listening ? undefined : read(path));
    });

    it("reads the server, so a newer console edit beats an offline replace (T-O3)", async () => {
      w.online = false;
      await replaceDocument.handle({ collection: "test", id: "b", fields: '{"n":3}' });
      w.online = true;
      w.dbSet("users/u/collections/test/b", { n: 99, _t: Date.parse("2026-10-29T13:00:00Z"), _d: "phone" });
      await reconcileAfterReconnect(steps());
      expect(w.dbGet("users/u/collections/test/b")).toMatchObject({ n: 99 });
      expect(host().state.mirror.get("test")?.get("b")?.fields).toEqual({ n: 99 });
      expect(host().state.pending.size).toBe(0);
      expect(order).toEqual(["stop", "reconcile", "start"]);
    });
    it("subscribes again even when the reconcile fails, and keeps the write pending", async () => {
      w.online = false;
      await replaceDocument.handle({ collection: "test", id: "b", fields: '{"n":3}' });
      w.online = true;
      await expect(reconcileAfterReconnect(steps(() => Promise.reject(new Error("dropped again"))))).rejects.toThrow(
        "dropped again",
      );
      expect(listening).toBe(true);
      expect(host().state.pending.has("test/b")).toBe(true);
    });
  });
});
