import { describe, expect, it } from "vitest";
import { parseD14Skip, UNLOCK_LINE_AT_MS } from "./config";

describe("D-14 config", () => {
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
