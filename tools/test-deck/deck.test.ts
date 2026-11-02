import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src/ext/commands.ts";
import { assembleTestDeck } from "./build.ts";
import { testDeck } from "./deck.ts";

type Row = Record<string, unknown>;
const buttons = testDeck("x").button_list as Row[];
const commands = buttons.flatMap((b) => (b.command_list as Row[]).map((c) => ({ button: String(b.button_id), c })));

describe("the test deck", () => {
  it("names the build in the deck and the tab, so a run can say what it tested", () => {
    expect(testDeck("x", "1101-1712").deck_name).toBe("SAMMI Firebase Tests 1101-1712");
    expect(assembleTestDeck("1101-1712")).toContain("build 1101-1712");
  });
  it("has a script and a command like the gateway probe, so SAMMI offers to uninstall it", () => {
    const sef = assembleTestDeck("x");
    expect(sef).toContain("[extension_name]\nSAMMI Firebase Test Deck\n");
    expect(sef).toContain("[insert_command]\nsammiFirebaseTestDeck.main();\n");
    const script = sef.slice(sef.indexOf("[insert_script]\n") + 16, sef.indexOf("[insert_over]"));
    expect(() => new Function(`${script}; sammiFirebaseTestDeck.main();`)).not.toThrow();
  });
  it("gives every button its own id and cell", () => {
    expect(new Set(buttons.map((b) => b.button_id)).size).toBe(buttons.length);
    const cells = buttons.map((b) => `${String(b.x)},${String(b.y)}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
  it("fits on the deck", () => {
    for (const b of buttons) {
      expect(Number(b.x) + Number(b.width)).toBeLessThanOrEqual(1);
      expect(Number(b.y) + Number(b.height)).toBeLessThanOrEqual(1);
    }
  });
  it("uses only commands and boxes the extension registers, and waits for every answer", () => {
    const registered = new Map(COMMANDS.map((c) => [c.name, Object.keys(c.boxes)]));
    for (const { button, c } of commands.filter(({ c }) => c.cmd === 0)) {
      const boxes = registered.get(String(c.extcmd));
      expect(boxes, `${button}: ${String(c.extcmd)}`).toBeDefined();
      const used = Object.keys(c).filter(
        (k) => !/^(b\d+|v\d+|obsid|vis|cmd|ext|extcmd|async|ms|sel|dis|xpan|pos)$/.test(k),
      );
      for (const k of used) expect(boxes, `${button}: box ${k}`).toContain(k);
      expect(c.async).toBe(0);
      expect(c.result, button).toBeTruthy();
    }
  });
  it("states the expected result in every alert, so a run can be judged without the guide", () => {
    const alerts = commands.filter(({ c }) => c.cmd === 142);
    expect(alerts.length).toBeGreaterThan(0);
    for (const { button, c } of alerts) expect(String(c.b0), button).toContain("expect");
  });
  it("reads the extension's variables through global", () => {
    for (const { button, c } of commands) expect(JSON.stringify(c), button).not.toContain("/$fb_");
  });
  it("triggers only buttons that exist", () => {
    const ids = buttons.map((b) => b.button_id);
    for (const { c } of commands.filter(({ c }) => c.cmd === 132)) expect(ids).toContain(c.b0);
  });
  it("assembles a .sef whose deck parses and whose T-C4 field exceeds the 4 KB cap", () => {
    const sef = assembleTestDeck();
    const over = JSON.parse(sef.slice(sef.indexOf("[insert_over]\n") + 14)) as { deck_data: string };
    const deck = JSON.parse(over.deck_data) as { button_list: Row[] };
    expect(deck.button_list).toHaveLength(buttons.length);
    const big = commands.find(({ c }) => c.id === "big");
    expect(String(big?.c.fields).length).toBeGreaterThan(9000);
  });
});
