import { beforeEach, describe, expect, it } from "vitest";
import { world } from "../../tools/feat-adapters/world.ts";
import { host, installHost } from "./host.ts";
import { invalidIniNotice, takeCatchUpNotice, unreachableNotice } from "./notices.ts";

describe("notices", () => {
  beforeEach(() => {
    installHost(world().ports());
  });

  it("says nothing when no ini edit was caught up", () => {
    expect(takeCatchUpNotice()).toBeUndefined();
  });
  it("reports a catch-up once, in the singular", () => {
    host().state.iniCatchUp = { pushed: 1, applied: 1 };
    expect(takeCatchUpNotice()).toBe("SAMMI Firebase: Back online: 1 local change pushed, 1 remote change applied");
    expect(takeCatchUpNotice()).toBeUndefined();
  });
  it("reports a catch-up in the plural", () => {
    host().state.iniCatchUp = { pushed: 2, applied: 0 };
    expect(takeCatchUpNotice()).toBe("SAMMI Firebase: Back online: 2 local changes pushed, 0 remote changes applied");
  });
  it("counts documents a large variable leaves out, and says nothing when there are none", () => {
    expect(unreachableNotice()).toBe("");
    host().state.unreachable.set("bulk", ["-a", "-b"]);
    expect(unreachableNotice()).toBe(" · 2 with a dash or space in the id: read with commands, not variables");
  });
  it("names invalid ini documents for the tab, and nothing when there are none", () => {
    expect(invalidIniNotice()).toBe("");
    host().state.invalidIni.push("test/a", "test/b");
    expect(invalidIniNotice()).toBe(" · invalid JSON ignored in firebase.ini: test/a, test/b");
  });
});
