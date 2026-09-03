import { describe, expect, it } from "vitest";
import { D14_PATTERN, parseD14Skip, patternsMatch, UNLOCK_LINE_AT_MS } from "./config";

describe("D-14 config", () => {
  it("exports the definitive 5-2-7-3-1-4-9-6 access pattern", () => {
    expect(D14_PATTERN).toEqual([4, 1, 6, 2, 0, 3, 8, 5]);
  });

  it("accepts only that sequence and rejects the former pattern", () => {
    expect(patternsMatch([4, 1, 6, 2, 0, 3, 8, 5])).toBe(true);
    expect(patternsMatch([1, 6, 5, 0, 7, 2, 4])).toBe(false);
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
