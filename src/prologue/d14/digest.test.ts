import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fingerprintsEqual, sha256Hex } from "./digest";

describe("sha256Hex", () => {
  it("matches Node crypto for short ASCII", () => {
    expect(sha256Hex("abc")).toBe(
      createHash("sha256").update("abc").digest("hex"),
    );
  });
});

describe("fingerprintsEqual", () => {
  it("accepts identical strings and rejects a mismatch", () => {
    expect(fingerprintsEqual("aa", "aa")).toBe(true);
    expect(fingerprintsEqual("aa", "ab")).toBe(false);
  });
});
