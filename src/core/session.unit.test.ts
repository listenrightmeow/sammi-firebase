import { describe, expect, it } from "vitest";
import { fail, ok } from "./answers.ts";
import { lostSessionAtStart, signInFailure } from "./session.ts";

describe("lostSessionAtStart", () => {
  it("is true only when a stored session was refused", () => {
    expect(lostSessionAtStart(true, fail("credentials invalid"))).toBe(true);
    expect(lostSessionAtStart(false, fail("credentials invalid"))).toBe(false);
    expect(lostSessionAtStart(true, ok({ answer: "ok" }))).toBe(false);
    expect(lostSessionAtStart(true, fail("api key invalid"))).toBe(false);
  });
});

describe("signInFailure", () => {
  it("names what the SDK's error means", () => {
    expect(signInFailure("auth/operation-not-allowed")).toBe("provider disabled");
    expect(signInFailure("auth/invalid-api-key")).toBe("api key invalid");
    expect(signInFailure("auth/wrong-password")).toBe("credentials invalid");
  });
  it("does not call a missing connection a bad password", () => {
    expect(signInFailure("auth/network-request-failed")).toBe("no internet");
    expect(signInFailure("TypeError: Failed to fetch dynamically imported module: https://x")).toBe("no internet");
  });
  it("is not a lost session at start", () => {
    expect(lostSessionAtStart(true, fail("no internet"))).toBe(false);
  });
});
