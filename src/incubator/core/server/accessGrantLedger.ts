import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const ACCESS_GRANT_IDS = new Set(
  Array.from({ length: 22 }, (_, index) => String(index + 1).padStart(2, "0")),
);

export interface AccessGrantLedger {
  isConsumed(accessGrantId: string): boolean;
  consume(accessGrantId: string): boolean;
}

function assertAccessGrantId(accessGrantId: string): void {
  if (!ACCESS_GRANT_IDS.has(accessGrantId)) {
    throw new Error("invalid_access_grant_id");
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT",
  );
}

export function createMemoryAccessGrantLedger(
  initialConsumed: readonly string[] = [],
): AccessGrantLedger {
  const consumed = new Set<string>();
  for (const accessGrantId of initialConsumed) {
    assertAccessGrantId(accessGrantId);
    consumed.add(accessGrantId);
  }
  return {
    isConsumed(accessGrantId) {
      assertAccessGrantId(accessGrantId);
      return consumed.has(accessGrantId);
    },
    consume(accessGrantId) {
      assertAccessGrantId(accessGrantId);
      if (consumed.has(accessGrantId)) return false;
      consumed.add(accessGrantId);
      return true;
    },
  };
}

function parseLedger(path: string): Set<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Set();
    }
    throw new Error("invalid_access_ledger", { cause: error });
  }
  if (
    typeof parsed !== "object"
    || parsed === null
    || Array.isArray(parsed)
    || Object.keys(parsed).length !== 1
    || !("consumedAccessGrantIds" in parsed)
    || !Array.isArray(parsed.consumedAccessGrantIds)
    || parsed.consumedAccessGrantIds.some((id) => typeof id !== "string" || !ACCESS_GRANT_IDS.has(id))
    || new Set(parsed.consumedAccessGrantIds).size !== parsed.consumedAccessGrantIds.length
  ) {
    throw new Error("invalid_access_ledger");
  }
  return new Set(parsed.consumedAccessGrantIds);
}

/**
 * Durable for one Node process. The in-process critical section is not a
 * distributed lock; multiple server instances require a shared transactional ledger.
 */
export function createFileAccessGrantLedger(path: string): AccessGrantLedger {
  const absolutePath = resolve(path);
  const consumed = parseLedger(absolutePath);
  return {
    isConsumed(accessGrantId) {
      assertAccessGrantId(accessGrantId);
      return consumed.has(accessGrantId);
    },
    consume(accessGrantId) {
      assertAccessGrantId(accessGrantId);
      if (consumed.has(accessGrantId)) return false;
      const next = [...consumed, accessGrantId].sort();
      const directory = dirname(absolutePath);
      mkdirSync(directory, { recursive: true });
      const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
      try {
        writeFileSync(
          temporaryPath,
          `${JSON.stringify({ consumedAccessGrantIds: next }, null, 2)}\n`,
          { encoding: "utf8", flag: "wx" },
        );
        renameSync(temporaryPath, absolutePath);
      } catch (error) {
        try {
          unlinkSync(temporaryPath);
        } catch {
          // The temporary file may not have been created.
        }
        throw error;
      }
      consumed.add(accessGrantId);
      return true;
    },
  };
}
