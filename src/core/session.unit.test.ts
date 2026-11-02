import { describe, expect, it } from "vitest";
import { fail, ok } from "./answers.ts";
import { lostSessionAtStart } from "./session.ts";

describe("lostSessionAtStart", () => {
  it("is true only when a stored session was refused", () => {
    expect(lostSessionAtStart(true, fail("credentials invalid"))).toBe(true);
    expect(lostSessionAtStart(false, fail("credentials invalid"))).toBe(false);
    expect(lostSessionAtStart(true, ok({ answer: "ok" }))).toBe(false);
    expect(lostSessionAtStart(true, fail("api key invalid"))).toBe(false);
  });
});
