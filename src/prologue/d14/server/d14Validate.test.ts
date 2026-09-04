import { afterEach, describe, expect, it } from "vitest";
import {
  handleValidateHost,
  handleValidatePattern,
  hostMatchesExpected,
  isValidPattern,
  parseExpectedPattern,
  patternMatchesExpected,
} from "./d14Validate";

const previousPattern = process.env.D14_PATTERN;
const previousHost = process.env.D14_HOST;

afterEach(() => {
  if (previousPattern === undefined) delete process.env.D14_PATTERN;
  else process.env.D14_PATTERN = previousPattern;
  if (previousHost === undefined) delete process.env.D14_HOST;
  else process.env.D14_HOST = previousHost;
});

describe("pattern payload rules", () => {
  it("rejects non-arrays, overflow, out-of-range, and duplicates", () => {
    expect(isValidPattern("0,1")).toBe(false);
    expect(isValidPattern([0, 1, 2, 3, 4, 5, 6, 7, 8, 0])).toBe(false);
    expect(isValidPattern([0, 9])).toBe(false);
    expect(isValidPattern([0, 1.5])).toBe(false);
    expect(isValidPattern([0, 0])).toBe(false);
    expect(isValidPattern([0, 1, 2])).toBe(true);
  });

  it("parses JSON or comma-separated env values", () => {
    expect(parseExpectedPattern("[0,1,2]")).toEqual([0, 1, 2]);
    expect(parseExpectedPattern("0,1,2")).toEqual([0, 1, 2]);
    expect(parseExpectedPattern("")).toBeNull();
  });
});

describe("patternMatchesExpected", () => {
  it("accepts only the exact expected sequence", () => {
    process.env.D14_PATTERN = "0,1,2";
    expect(patternMatchesExpected([0, 1, 2])).toBe(true);
    expect(patternMatchesExpected([2, 1, 0])).toBe(false);
    expect(patternMatchesExpected([0, 1])).toBe(false);
  });

  it("refuses when the env is missing", () => {
    delete process.env.D14_PATTERN;
    expect(patternMatchesExpected([0, 1, 2])).toBe(false);
  });
});

describe("hostMatchesExpected", () => {
  it("normalizes trim and case before compare", () => {
    process.env.D14_HOST = "Example";
    expect(hostMatchesExpected(" example ")).toBe(true);
    expect(hostMatchesExpected("EXAMPLE")).toBe(true);
    expect(hostMatchesExpected("exampl")).toBe(false);
  });
});

describe("HTTP handlers", () => {
  it("returns only ok true/false for pattern", async () => {
    process.env.D14_PATTERN = "[4,5,6]";
    const good = await handleValidatePattern(
      new Request("http://localhost/api/validate-pattern", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern: [4, 5, 6] }),
      }),
    );
    const bad = await handleValidatePattern(
      new Request("http://localhost/api/validate-pattern", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern: [0] }),
      }),
    );
    expect(good.status).toBe(200);
    expect(await good.json()).toEqual({ ok: true });
    expect(await bad.json()).toEqual({ ok: false });
  });

  it("returns only ok true/false for host", async () => {
    process.env.D14_HOST = "sample-host";
    const good = await handleValidateHost(
      new Request("http://localhost/api/validate-host", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ host: "Sample-Host" }),
      }),
    );
    const bad = await handleValidateHost(
      new Request("http://localhost/api/validate-host", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ host: "other" }),
      }),
    );
    expect(await good.json()).toEqual({ ok: true });
    expect(await bad.json()).toEqual({ ok: false });
  });
});
