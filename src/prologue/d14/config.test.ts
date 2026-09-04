import { describe, expect, it } from "vitest";
import { parseD14Skip, patternsMatch, UNLOCK_LINE_AT_MS } from "./config";
import { hostMatches } from "./sealed";

describe("D-14 config", () => {
  it("accepts the sealed access pattern and rejects the former one", () => {
    expect(patternsMatch([4, 1, 6, 2, 0, 3, 8, 5])).toBe(true);
    expect(patternsMatch([1, 6, 5, 0, 7, 2, 4])).toBe(false);
  });

  it("accepts the sealed host and rejects a near miss", () => {
    expect(hostMatches("ceres")).toBe(true);
    expect(hostMatches("ceres ")).toBe(false);
    expect(hostMatches("Ceres")).toBe(false);
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
