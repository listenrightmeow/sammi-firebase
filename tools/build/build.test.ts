import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alert, comment, deck, deleteVariable, extension, extensionCommands, setString } from "./deck.ts";
import { assemble, bundle, check, run, SEF_MAX } from "./sef.ts";
import { gate } from "./coverage-gate.ts";

const SCRIPT = 'var sammiFirebase=(()=>{const SDK="https://www.gstatic.com/firebasejs/10.12.0";return{main(){}}})();';
const parts = { version: "0.1.0", script: SCRIPT, tab: "<div></div>", uniqueId: "sammifirebase010" };

describe("the bundled deck", () => {
  it("every extension command is synchronous (S6)", () => {
    const cmds = extensionCommands(deck("x"));
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) expect(c.async).toBe(0);
  });
  it("builds the verified command types", () => {
    expect(comment("c").cmd).toBe(2);
    expect(alert("a").cmd).toBe(142);
    expect(deleteVariable("v").cmd).toBe(78);
    expect(setString("v", "t")).toMatchObject({ cmd: 20, b0: "v", b1: "t" });
    expect(extension("Firebase: Get Status", { result: "r" })).toMatchObject({
      cmd: 0,
      extcmd: "Firebase: Get Status",
      async: 0,
    });
  });
  it("finds commands in release lists too, and tolerates a deck without buttons", () => {
    const d = { button_list: [{ release_list: [extension("X", {})] }] };
    expect(extensionCommands(d)).toEqual([{ name: "X", async: 0 }]);
    expect(extensionCommands({})).toEqual([]);
  });
});

describe("the .sef", () => {
  it("assembles the sections in order and passes the build check", () => {
    const sef = assemble(parts);
    expect(sef.indexOf("[extension_name]")).toBeLessThan(sef.indexOf("[insert_over]"));
    expect(check(sef)).toEqual([]);
  });
  it("names each failure", () => {
    const over = JSON.stringify({
      deck_data: JSON.stringify({ button_list: [{ command_list: [{ cmd: 0, extcmd: "X" }] }] }),
      sammi_version: "2024.1.0",
      bridge: false,
    });
    const bad = `[insert_script]\nfunction (\nhttp://example.com\n[insert_over]\n${over}`;
    expect(check(bad)).toEqual([
      expect.stringMatching(/does not parse/),
      "sammi_version must be 2025.2.0",
      "bridge must be true",
      `deck command 'X' must carry "async": 0.0 (S6)`,
      "the .sef contains an http:// URL",
      "the Firebase SDK URL must appear exactly once, found 0",
    ]);
  });
  it("refuses an unparseable [insert_over], an unparseable deck, and an oversized file", () => {
    expect(check("[insert_over]\nnot json")).toContain("[insert_over] is not JSON");
    expect(check('[insert_over]\n{"deck_data":"nope"}')).toContain("deck_data is not JSON");
    const big = assemble({ ...parts, tab: "x".repeat(SEF_MAX) });
    expect(check(big)).toContainEqual(expect.stringMatching(/over the 204800 cap/));
  });
  it("a missing section reads as empty", () => {
    expect(check("")).toContain("[insert_over] is not JSON");
  });
  it("writes dist/sammi-firebase.sef, and with --check passes the gates", async () => {
    expect(await run([])).toBe(0);
    expect(await run(["--check"])).toBe(0);
  }, 30000);
  it("bundles the Bridge entry point into one classic script exposing main()", async () => {
    const js = await bundle();
    expect(js).toMatch(/var sammiFirebase = /);
    expect(check(assemble({ ...parts, script: js }))).toEqual([]);
  }, 30000);
});

describe("the coverage gate", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const gates = join(dir, "gates.json");
  writeFileSync(gates, JSON.stringify({ const: { coverage: { lines: 95, branches: 95, scope: ["src/core/**"] } } }));
  const file = (hits: number) => ({
    "/repo/src/core/a.ts": {
      path: "/repo/src/core/a.ts",
      statementMap: { "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } } },
      fnMap: {},
      branchMap: {},
      s: { "0": hits },
      f: {},
      b: {},
    },
    "/repo/other/b.ts": {
      path: "/repo/other/b.ts",
      statementMap: { "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } } },
      fnMap: {},
      branchMap: {},
      s: { "0": 0 },
      f: {},
      b: {},
    },
  });
  it("merges reports, scopes them, and passes at the floor", () => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(file(0)));
    writeFileSync(b, JSON.stringify(file(3)));
    expect(gate([a, b], gates)).toMatchObject({ ok: true, lines: 100 });
  });
  it("fails below the floor and names the uncovered lines", () => {
    const a = join(dir, "c.json");
    writeFileSync(a, JSON.stringify(file(0)));
    const r = gate([a], gates);
    expect(r.ok).toBe(false);
    expect(r.report).toContain("/repo/src/core/a.ts: lines 1");
  });
  it("a missing report is a failure, never a pass", () => {
    expect(gate([join(dir, "absent.json")], gates)).toMatchObject({
      ok: false,
      report: [expect.stringMatching(/missing coverage report/)],
    });
  });
});

describe("the count assertions", async () => {
  const { counts, junitTotals, scenarioCount, walk } = await import("./counts.ts");
  const { mkdirSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "counts-"));
  mkdirSync(join(dir, "specs", "a"), { recursive: true });
  writeFileSync(join(dir, "specs", "a", "a.feat"), 'scenario "one":\nscenario "two":\n');
  const junit = (tests: number, failures = 0) => {
    const p = join(dir, `j${tests}-${failures}.xml`);
    writeFileSync(
      p,
      `<?xml version="1.0"?><testsuites name="x" tests="${tests}" failures="${failures}" errors="0"></testsuites>`,
    );
    return p;
  };
  it("reads JUnit totals and counts scenarios", () => {
    expect(junitTotals('<testsuites tests="3" failures="1" errors="1">')).toEqual({ tests: 3, failures: 2 });
    expect(scenarioCount(walk(join(dir, "specs"), ".feat"))).toBe(2);
  });
  it("fails when a suite was not generated, nothing ran, or a test failed", () => {
    expect(counts(join(dir, "specs"), junit(0))).toEqual([
      "generated suites 0 != specs 1",
      "the run executed zero tests",
    ]);
    writeFileSync(join(dir, "specs", "a", "a.test.ts"), "");
    expect(counts(join(dir, "specs"), junit(2, 1))).toEqual(["1 generated test(s) failed"]);
    expect(counts(join(dir, "specs"), junit(3))).toEqual(["executed tests 3 != scenarios 2"]);
    expect(counts(join(dir, "specs"), junit(2))).toEqual([]);
  });
  it("an empty spec directory is a failure", () => {
    const empty = mkdtempSync(join(tmpdir(), "empty-"));
    expect(counts(empty, junit(2))).toContain("no .feat specs found");
  });
});
