import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import {
  CANONICAL_PLAYER_CODE_HASHES,
  type PlayerCodeHashEntry,
} from "./playerCodeHashes.js";

const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  digest: Buffer;
}

export type PlayerCodeVerifier = (playerCode: string) => Promise<string | undefined>;

function deriveKey(
  playerCode: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(playerCode, salt, keyLength, { ...options, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function parseEncodedHash(encodedHash: string): ParsedHash {
  const [algorithm, version, parameters, saltBase64, digestBase64, ...extra] =
    encodedHash.split("$");
  if (
    algorithm !== "scrypt"
    || version !== "v=1"
    || extra.length > 0
    || !parameters
    || !saltBase64
    || !digestBase64
  ) {
    throw new Error("invalid_player_code_hash");
  }

  const parsedParameters = Object.fromEntries(
    parameters.split(",").map((entry) => entry.split("=")),
  );
  const N = Number(parsedParameters.N);
  const r = Number(parsedParameters.r);
  const p = Number(parsedParameters.p);
  const salt = Buffer.from(saltBase64, "base64");
  const digest = Buffer.from(digestBase64, "base64");
  if (
    !Number.isSafeInteger(N)
    || !Number.isSafeInteger(r)
    || !Number.isSafeInteger(p)
    || N < 2
    || r < 1
    || p < 1
    || salt.length < 16
    || digest.length !== KEY_LENGTH
  ) {
    throw new Error("invalid_player_code_hash");
  }
  return { N, r, p, salt, digest };
}

export async function hashPlayerCode(
  playerCode: string,
  salt = randomBytes(16),
): Promise<string> {
  const N = 16_384;
  const r = 8;
  const p = 1;
  const digest = await deriveKey(playerCode, salt, KEY_LENGTH, {
    N,
    r,
    p,
  });
  return `scrypt$v=1$N=${N},r=${r},p=${p}$${salt.toString("base64")}$${digest.toString("base64")}`;
}

export function createPlayerCodeVerifier(
  entries: readonly PlayerCodeHashEntry[],
): PlayerCodeVerifier {
  const parsedEntries = entries.map((entry) => ({
    subjectId: entry.subjectId,
    hash: parseEncodedHash(entry.encodedHash),
  }));

  return async (playerCode) => {
    const candidates = await Promise.all(parsedEntries.map((entry) =>
      deriveKey(playerCode, entry.hash.salt, entry.hash.digest.length, {
        N: entry.hash.N,
        r: entry.hash.r,
        p: entry.hash.p,
      })
    ));
    let resolvedSubjectId: string | undefined;
    for (const [index, entry] of parsedEntries.entries()) {
      const candidate = candidates[index]!;
      if (timingSafeEqual(candidate, entry.hash.digest)) {
        resolvedSubjectId = entry.subjectId;
      }
    }
    return resolvedSubjectId;
  };
}

export const verifyCanonicalPlayerCode =
  createPlayerCodeVerifier(CANONICAL_PLAYER_CODE_HASHES);
