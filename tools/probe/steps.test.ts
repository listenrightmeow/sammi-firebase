import { describe, expect, it } from "vitest";
import { helperNames, PROBE_FILE, runProbe, STEPS, type Bridge } from "./steps.ts";

// A Bridge that behaves the way the fake world assumes (tools/feat-adapters/world.ts): ini text one
// key at a time, replies under .Value, an empty value reading as absent, object variables kept.
function bridge(overrides: Partial<Bridge> = {}): Bridge & { ini: Map<string, string>; calls: string[] } {
  const ini = new Map<string, string>();
  const vars = new Map<string, unknown>();
  const calls: string[] = [];
  const base: Bridge = {
    saveIni: async (file, section, key, value) => {
      calls.push(`saveIni ${file} [${section}] ${key}`);
      ini.set(`${file}|${section}|${key}`, value);
      return { Value: "ok" };
    },
    loadIni: async (file, section, key) => ({ Value: ini.get(`${file}|${section}|${key}`) ?? "" }),
    setVariable: async (name, value) => void vars.set(name, structuredClone(value)),
    getVariable: async (name) => ({ Value: vars.get(name) }),
    triggerExt: async () => undefined,
  };
  return Object.assign({ ...base, ...overrides }, { ini, calls });
}

const meta = { version: "1.0.0", userAgent: "test", now: () => new Date("2026-10-30T12:00:00Z") };

describe("gateway probe", () => {
  it("passes every step against a Bridge that behaves like the fakes", async () => {
    const report = await runProbe(bridge(), meta);
    expect(report.steps.map((s) => [s.id, s.pass])).toEqual(STEPS.map((s) => [s.id, true]));
    expect(report).toMatchObject({ probe: "gateway-probe", version: "1.0.0", ranAt: "2026-10-30T12:00:00.000Z" });
  });

  it("writes only to the probe's own ini file", async () => {
    const b = bridge();
    await runProbe(b, meta);
    expect(b.calls.length).toBeGreaterThan(0);
    expect(b.calls.every((c) => c.startsWith(`saveIni ${PROBE_FILE} `))).toBe(true);
  });

  it("records the raw replies, so a different reply shape is visible", async () => {
    const report = await runProbe(bridge(), meta);
    expect(report.steps.find((s) => s.id === "ini-read-shape")?.replies).toEqual([{ Value: "ok" }, { Value: "hello" }]);
  });

  it("reports a step that differs from the fakes", async () => {
    // A Bridge that keeps "" as a value and drops colons from section names.
    const ini = new Map<string, string>();
    const report = await runProbe(
      bridge({
        saveIni: async (_f, section, key, value) => void ini.set(`${section.replace(":", "")}|${key}`, value),
        loadIni: async (_f, section, key) => ({ Value: ini.get(`${section}|${key}`) }),
      }),
      meta,
    );
    const failed = report.steps.filter((s) => !s.pass).map((s) => s.id);
    expect(failed).toEqual(["ini-colon-section"]);
    expect(report.steps.find((s) => s.id === "ini-delete-fallback")?.observed).toBe("absent");
  });

  it("records a thrown helper as a failed step and keeps going", async () => {
    const report = await runProbe(
      bridge({
        triggerExt: async () => {
          throw new Error("no such trigger");
        },
      }),
      meta,
    );
    const t = report.steps.find((s) => s.id === "trigger");
    expect(t).toMatchObject({ pass: false, error: "no such trigger", observed: null });
    expect(report.steps).toHaveLength(STEPS.length);
  });

  it("lists the Bridge's helper functions, sorted", () => {
    expect(helperNames({ saveIni: () => 0, deleteIni: () => 0, version: "1" })).toEqual(["deleteIni", "saveIni"]);
  });
});
