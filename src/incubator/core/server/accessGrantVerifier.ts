import type { PlayerCodeHashEntry } from "./playerCodeHashes.js";
import { createPlayerCodeVerifier, hashPlayerCode } from "./playerCodeVerifier.js";
import {
  CANONICAL_ACCESS_GRANT_HASHES,
  type AccessGrantHashEntry,
} from "./accessGrantHashes.js";

export type AccessGrantVerifier = (accessCode: string) => Promise<string | undefined>;

export function normalizeAccessCode(accessCode: string): string | undefined {
  const normalized = accessCode.trim().toUpperCase();
  return /^[A-Z][0-9]-[A-Z][0-9]$/.test(normalized) ? normalized : undefined;
}

export function createAccessGrantVerifier(
  entries: readonly AccessGrantHashEntry[],
): AccessGrantVerifier {
  const verify = createPlayerCodeVerifier(entries.map((entry): PlayerCodeHashEntry => ({
    subjectId: entry.accessGrantId,
    encodedHash: entry.encodedHash,
  })));
  return async (accessCode) => {
    const normalized = normalizeAccessCode(accessCode);
    return normalized ? verify(normalized) : undefined;
  };
}

export const verifyCanonicalAccessGrant =
  createAccessGrantVerifier(CANONICAL_ACCESS_GRANT_HASHES);

export { hashPlayerCode as hashAccessCode };
