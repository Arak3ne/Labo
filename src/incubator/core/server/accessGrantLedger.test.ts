import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFileAccessGrantLedger,
  createMemoryAccessGrantLedger,
} from "./accessGrantLedger";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("access grant ledger", () => {
  it("consumes each grant atomically in memory", () => {
    const ledger = createMemoryAccessGrantLedger();
    expect(ledger.consume("01")).toBe(true);
    expect(ledger.consume("01")).toBe(false);
    expect(ledger.isConsumed("01")).toBe(true);
  });

  it("survives a file-ledger restart with IDs only", () => {
    const directory = mkdtempSync(join(tmpdir(), "labo-ledger-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "nested", "ledger.json");
    expect(createFileAccessGrantLedger(path).consume("22")).toBe(true);

    const restarted = createFileAccessGrantLedger(path);
    expect(restarted.isConsumed("22")).toBe(true);
    expect(restarted.consume("22")).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      consumedAccessGrantIds: ["22"],
    });
  });

  it("rejects malformed or out-of-range persisted data", () => {
    const directory = mkdtempSync(join(tmpdir(), "labo-ledger-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "ledger.json");
    writeFileSync(path, JSON.stringify({ consumedAccessGrantIds: ["23"] }));
    expect(() => createFileAccessGrantLedger(path)).toThrow("invalid_access_ledger");
  });
});
