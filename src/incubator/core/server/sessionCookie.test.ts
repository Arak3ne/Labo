import { describe, expect, it } from "vitest";
import { createSessionToken, playerIdFromSessionToken } from "./sessionCookie";

describe("signed session cookie", () => {
  it("round-trips a player id", () => {
    const token = createSessionToken("A1", 2_000, "secret");
    expect(playerIdFromSessionToken(token, "secret", 1_000)).toBe("A1");
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken("A1", 2_000, "secret");
    expect(playerIdFromSessionToken(token, "other", 1_000)).toBeUndefined();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken("A1", 1_000, "secret");
    expect(playerIdFromSessionToken(token, "secret", 1_001)).toBeUndefined();
  });
});
