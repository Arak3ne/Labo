import { describe, expect, it } from "vitest";
import { mapCoreDenial } from "./mapCoreDenial";

describe("mapCoreDenial", () => {
  it("keeps consent refusal distinct from incomplete consent", () => {
    expect(mapCoreDenial("consent_refused")).toBe("consent_refused");
    expect(mapCoreDenial("consent_incomplete")).toBe("consent_missing");
  });

  it("maps subject validation and access failures without domain logic", () => {
    expect(mapCoreDenial("duplicate_subjects")).toBe("invalid_selection");
    expect(mapCoreDenial("access_exhausted")).toBe("access_denied");
  });
});
