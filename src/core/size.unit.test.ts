import { beforeEach, describe, expect, it } from "vitest";
import { world } from "../../tools/feat-adapters/world.ts";
import { host, installHost } from "./host.ts";
import { pollVariables } from "./poll.ts";
import { boot, MESSAGE_MAX, publish, readChain, withinMessage, writeChain, writeHashes } from "./store.ts";
import type { StoredDoc } from "./state.ts";

type Sent = { name: string; value: unknown; size: number };

const big = "x".repeat(2000);
const seed = (count: number, id = (i: number) => `d${i}`) => {
  const docs = new Map<string, StoredDoc>();
  for (let i = 0; i < count; i++) docs.set(id(i), { fields: { x: big }, t: 1, d: "dev1" });
  host().state.mirror.set("bulk", docs);
};

describe("a collection larger than one message", () => {
  let sent: Sent[];
  beforeEach(() => {
    sent = [];
    const ports = world().ports();
    const real = ports.sammi.setVariable;
    ports.sammi.setVariable = async (name, value) => {
      sent.push({ name, value, size: JSON.stringify(value).length });
      await real(name, value);
    };
    installHost(ports);
    host().state.connected = true;
  });

  it("publishes a small collection whole, in one message", async () => {
    seed(3);
    await publish("bulk");
    expect(sent.map((s) => s.name)).toEqual(["fb_bulk"]);
  });
  it("chains a large first publish, with no message over the cap", async () => {
    seed(50);
    await publish("bulk");
    expect(sent[0]?.name).toBe("fb_bulk");
    expect(sent.length).toBeGreaterThan(1);
    expect(Math.max(...sent.map((s) => s.size))).toBeLessThanOrEqual(MESSAGE_MAX);
    const docs = sent.slice(1).map((s) => s.name);
    expect(docs).toContain("fb_bulk.d49");
    const first = Object.keys(sent[0]?.value as object);
    expect(first.length + docs.length).toBe(50);
  });
  it("sends only the changed document once a large collection is published", async () => {
    seed(50);
    await publish("bulk");
    sent.length = 0;
    host()
      .state.mirror.get("bulk")
      ?.set("d7", { fields: { x: "changed" }, t: 2, d: "dev1" });
    await publish("bulk");
    expect(sent).toEqual([{ name: "fb_bulk.d7", value: { x: "changed" }, size: 15 }]);
  });
  it("resends one document on request, so a refused variable write snaps back", async () => {
    seed(50);
    await publish("bulk");
    sent.length = 0;
    await publish("bulk", { resend: "d7" });
    expect(sent.map((s) => s.name)).toEqual(["fb_bulk.d7"]);
  });
  it("clears a removed document from a large collection", async () => {
    seed(50);
    await publish("bulk");
    sent.length = 0;
    host().state.mirror.get("bulk")?.delete("d7");
    await publish("bulk");
    expect(sent.map((s) => [s.name, s.value])).toEqual([["fb_bulk.d7", null]]);
  });
  it("goes back to one whole message when the collection shrinks", async () => {
    seed(50);
    await publish("bulk");
    sent.length = 0;
    for (let i = 3; i < 50; i++) host().state.mirror.get("bulk")?.delete(`d${i}`);
    await publish("bulk");
    expect(sent.map((s) => s.name)).toEqual(["fb_bulk"]);
  });
  it("leaves an id a dotted path cannot reach out of the chain, and still publishes the rest", async () => {
    seed(50, (i) => (i === 49 ? "-dash" : `d${i}`));
    await publish("bulk");
    expect(sent.map((s) => s.name)).not.toContain("fb_bulk.-dash");
    expect(sent.map((s) => s.name)).toContain("fb_bulk.d48");
    expect(host().state.unreachable.get("bulk")).toEqual(["-dash"]);
  });
  it("does not poll while a chain is on its way", async () => {
    seed(50);
    await publish("bulk");
    host().state.publishing = 1;
    const reads: string[] = [];
    await pollVariables(
      async (n) => (reads.push(n), {}),
      async () => undefined,
    );
    expect(reads).toEqual([]);
  });
  it("polls a large collection a few documents at a time, and comes round to all of them", async () => {
    seed(50);
    await publish("bulk");
    const reads: string[] = [];
    const changes: unknown[] = [];
    const tick = () =>
      pollVariables(
        async (n) => {
          reads.push(n);
          return n === "fb_bulk.d42" ? { x: "edited" } : { x: big };
        },
        async (c) => void changes.push(c),
      );
    await tick();
    expect(reads.length).toBeLessThanOrEqual(10);
    expect(reads.every((n) => n.startsWith("fb_bulk."))).toBe(true);
    for (let i = 0; i < 5; i++) await tick();
    expect(new Set(reads).size).toBe(50);
    expect(changes).toEqual([{ collection: "bulk", id: "d42", field: "x", value: "edited" }]);
  });
  it("does not delete a document a large poll could not read", async () => {
    seed(50);
    await publish("bulk");
    const changes: unknown[] = [];
    await pollVariables(
      async () => undefined,
      async (c) => void changes.push(c),
    );
    expect(changes).toEqual([]);
  });
});

describe("an ini value larger than one message", () => {
  type Write = [string, string, string];
  let writes: Write[];
  beforeEach(() => {
    writes = [];
    const ports = world().ports();
    const real = ports.ini.write;
    ports.ini.write = async (s, k, v) => {
      writes.push([s, k, v]);
      await real(s, k, v);
    };
    installHost(ports);
  });

  it("writes a small value as one plain key", async () => {
    await writeChain("index", "bulk", "short");
    expect(writes).toEqual([["index", "bulk", "short"]]);
    expect(await readChain("index", "bulk")).toBe("short");
  });
  it("chains a large value under the cap, and reads it back whole", async () => {
    const text = "a".repeat(MESSAGE_MAX * 2 + 5);
    await writeChain("index", "bulk", text);
    expect(writes.map((w) => w[1])).toEqual(["bulk", "bulk__part1", "bulk__part2"]);
    expect(Math.max(...writes.map((w) => w[2].length))).toBeLessThanOrEqual(MESSAGE_MAX);
    expect(await readChain("index", "bulk")).toBe(text);
  });
  it("rewrites only the parts that changed", async () => {
    const text = "a".repeat(MESSAGE_MAX * 2 + 5);
    await writeChain("index", "bulk", text);
    writes.length = 0;
    await writeChain("index", "bulk", `${text}b`);
    expect(writes.map((w) => w[1])).toEqual(["bulk__part2"]);
  });
  it("reads back correctly when a value shrinks, and clears the parts it no longer uses", async () => {
    await writeChain("index", "bulk", "a".repeat(MESSAGE_MAX * 2 + 5));
    await writeChain("index", "bulk", "short");
    expect(await readChain("index", "bulk")).toBe("short");
    expect(writes.at(-1)?.[1]).toBe("bulk__part2");
    expect(writes.at(-1)?.[2]).toBe("");
  });
  it("reads a value of exactly one part", async () => {
    const text = "a".repeat(MESSAGE_MAX);
    await writeChain("index", "bulk", text);
    expect(await readChain("index", "bulk")).toBe(text);
  });
  it("keeps every hash across a restart when the list spans parts", async () => {
    const { state } = host();
    for (let i = 0; i < 2000; i++) state.hashes.set(`bulk/d${i}`, "abcdef12");
    await writeHashes();
    expect(writes.length).toBeGreaterThan(1);
    state.booted = false;
    state.hashes = new Map();
    await boot();
    expect(host().state.hashes.size).toBe(2000);
  });
});

describe("the fake's dot notation", () => {
  it("sets and clears a nested value, and fails like SAMMI when the parent is missing", async () => {
    const w = world();
    const { sammi } = w.ports();
    await sammi.setVariable("fb_c", { a: { n: 1 } });
    await sammi.setVariable("fb_c.b", { n: 2 });
    expect(w.variables.get("fb_c")).toEqual({ a: { n: 1 }, b: { n: 2 } });
    await sammi.setVariable("fb_c.a", null);
    expect(w.variables.get("fb_c")).toEqual({ b: { n: 2 } });
    await sammi.setVariable("fb_c.b.n", 3);
    expect(w.variables.get("fb_c")).toEqual({ b: { n: 3 } });
    await expect(sammi.setVariable("fb_c.missing.n", 1)).rejects.toThrow("fatal");
    await expect(sammi.setVariable("fb_none.a", 1)).rejects.toThrow("fatal");
  });
});

describe("withinMessage", () => {
  it("passes an answer under the cap", () => {
    expect(withinMessage("ok")).toBe("ok");
  });
  it("refuses an answer over the cap instead of letting the websocket drop it", () => {
    expect(withinMessage("x".repeat(MESSAGE_MAX + 1))).toBe("error: too large");
  });
  it("measures bytes, not characters", () => {
    expect(withinMessage("é".repeat(MESSAGE_MAX))).toBe("error: too large");
  });
});
