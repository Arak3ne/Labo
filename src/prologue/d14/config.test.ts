import { describe, expect, it } from "vitest";
import { D14_PATTERN, parseD14Skip, patternsMatch, UNLOCK_LINE_AT_MS } from "./config";

describe("D-14 config", () => {
  it("exports the definitive 2-7-6-1-8-3-5 access pattern", () => {
    expect(D14_PATTERN).toEqual([1, 6, 5, 0, 7, 2, 4]);
  });

  it("accepts only that sequence and rejects the former left-column pattern", () => {
    expect(patternsMatch([1, 6, 5, 0, 7, 2, 4])).toBe(true);
    expect(patternsMatch([0, 3, 6, 7, 8])).toBe(false);
  });

  it("parses DEV skip query values", () => {
    expect(parseD14Skip("?d14=desktop")).toBe("desktop");
    expect(parseD14Skip("?d14=climax")).toBe("climax");
    expect(parseD14Skip("?d14=other")).toBeNull();
    expect(parseD14Skip("")).toBeNull();
  });

  it("dumps unlock lines on a tight cadence then holds", () => {
    expect(UNLOCK_LINE_AT_MS).toEqual([20, 80, 160]);
  });
});
