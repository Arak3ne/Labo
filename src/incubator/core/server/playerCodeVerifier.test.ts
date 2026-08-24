import { describe, expect, it } from "vitest";
import { CANONICAL_SUBJECT_IDS } from "../players.mock";
import { CANONICAL_PLAYER_CODE_HASHES } from "./playerCodeHashes";
import {
  createPlayerCodeVerifier,
  hashPlayerCode,
  verifyCanonicalPlayerCode,
} from "./playerCodeVerifier";

describe("server-only player code verification", () => {
  it("stores exactly one versioned salted hash for every canonical subject", () => {
    expect(CANONICAL_PLAYER_CODE_HASHES.map((entry) => entry.subjectId))
      .toEqual(CANONICAL_SUBJECT_IDS);
    expect(new Set(CANONICAL_PLAYER_CODE_HASHES.map((entry) => entry.encodedHash)).size).toBe(16);
    for (const entry of CANONICAL_PLAYER_CODE_HASHES) {
      expect(entry.encodedHash).toMatch(
        /^scrypt\$v=1\$N=16384,r=8,p=1\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/,
      );
    }
  });

  it("resolves injected salted test hashes and refuses invalid codes", async () => {
    const entries = await Promise.all([
      { subjectId: "A1", playerCode: "temporary-test-code-one" },
      { subjectId: "A2", playerCode: "temporary-test-code-two" },
    ].map(async ({ subjectId, playerCode }, index) => ({
      subjectId,
      encodedHash: await hashPlayerCode(playerCode, Buffer.alloc(16, index + 1)),
    })));
    const verify = createPlayerCodeVerifier(entries);

    await expect(verify("temporary-test-code-one")).resolves.toBe("A1");
    await expect(verify("temporary-test-code-two")).resolves.toBe("A2");
    await expect(verify("invalid")).resolves.toBeUndefined();
  });

  it.runIf(Boolean(process.env.LABO_TEST_CANONICAL_CODES_JSON))(
    "resolves the 16 canonical codes supplied only at test runtime",
    async () => {
      const codes = JSON.parse(process.env.LABO_TEST_CANONICAL_CODES_JSON!) as Record<string, string>;
      expect(Object.keys(codes).sort()).toEqual([...CANONICAL_SUBJECT_IDS].sort());
      for (const subjectId of CANONICAL_SUBJECT_IDS) {
        await expect(verifyCanonicalPlayerCode(codes[subjectId]!)).resolves.toBe(subjectId);
      }
    },
    30_000,
  );
});
