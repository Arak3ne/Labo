import { describe, expect, it } from "vitest";
import { CANONICAL_ACCESS_GRANT_HASHES } from "./accessGrantHashes";
import {
  createAccessGrantVerifier,
  hashAccessCode,
  normalizeAccessCode,
  verifyCanonicalAccessGrant,
} from "./accessGrantVerifier";

const ACCESS_GRANT_IDS = Array.from(
  { length: 22 },
  (_, index) => String(index + 1).padStart(2, "0"),
);

describe("server-only access grant verification", () => {
  it("stores exactly 22 distinct salted hashes", () => {
    expect(CANONICAL_ACCESS_GRANT_HASHES.map((entry) => entry.accessGrantId))
      .toEqual(ACCESS_GRANT_IDS);
    expect(new Set(CANONICAL_ACCESS_GRANT_HASHES.map((entry) => entry.encodedHash)).size).toBe(22);
    expect(JSON.stringify(CANONICAL_ACCESS_GRANT_HASHES)).not.toMatch(/[A-Z][0-9]-[A-Z][0-9]/);
  });

  it("normalizes strict access codes and scans every injected hash", async () => {
    const entries = await Promise.all([
      { accessGrantId: "01", code: "A1-B2" },
      { accessGrantId: "02", code: "C3-D4" },
    ].map(async ({ accessGrantId, code }, index) => ({
      accessGrantId,
      encodedHash: await hashAccessCode(code, Buffer.alloc(16, index + 1)),
    })));
    const verify = createAccessGrantVerifier(entries);

    await expect(verify("  a1-b2 ")).resolves.toBe("01");
    await expect(verify("C3-D4")).resolves.toBe("02");
    await expect(verify("A1B2")).resolves.toBeUndefined();
    expect(normalizeAccessCode("AA-AA")).toBeUndefined();
  });

  it.runIf(Boolean(process.env.LABO_TEST_CANONICAL_ACCESS_CODES_JSON))(
    "resolves canonical access codes supplied only at runtime",
    async () => {
      const codes = JSON.parse(
        process.env.LABO_TEST_CANONICAL_ACCESS_CODES_JSON!,
      ) as Record<string, string>;
      expect(Object.keys(codes).sort()).toEqual(ACCESS_GRANT_IDS);
      for (const accessGrantId of ACCESS_GRANT_IDS) {
        await expect(verifyCanonicalAccessGrant(codes[accessGrantId]!))
          .resolves.toBe(accessGrantId);
      }
    },
    45_000,
  );
});
