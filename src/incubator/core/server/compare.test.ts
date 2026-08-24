import { describe, expect, it } from "vitest";
import { computeRevealCode } from "./compare";
import {
  CANONICAL_BIOLOGICAL_SIGNATURES,
  resetBiologicalSignaturesForTests,
  seedBiologicalSignatures,
} from "./signatures";
import { createMockPlayers } from "../players.mock";

describe("server compare", () => {
  it("contains the exact V17 matrix only on the server", () => {
    expect([...CANONICAL_BIOLOGICAL_SIGNATURES]).toEqual([
      ["A1", ["γ", "α"]], ["A2", ["δ", "β"]], ["A3", ["β", "δ"]], ["A4", ["γ", "α"]],
      ["B1", ["δ", "γ"]], ["B2", ["δ", "α"]], ["B3", ["β", "γ"]], ["B4", ["α", "β"]],
      ["C1", ["α", "γ"]], ["C2", ["α", "γ"]], ["C3", ["γ", "β"]], ["C4", ["α", "δ"]],
      ["D1", ["δ", "β"]], ["D2", ["β", "δ"]], ["D3", ["γ", "δ"]], ["D4", ["β", "α"]],
    ]);
  });

  it("gives every subject exactly two distinct markers", () => {
    expect(CANONICAL_BIOLOGICAL_SIGNATURES.size).toBe(16);
    for (const signature of CANONICAL_BIOLOGICAL_SIGNATURES.values()) {
      expect(signature).toHaveLength(2);
      expect(signature[0]).not.toBe(signature[1]);
    }
  });

  it("distributes all 120 unordered distinct pairs as 64 zero, 44 one, and 12 M", () => {
    resetBiologicalSignaturesForTests();
    seedBiologicalSignatures(createMockPlayers().map((player) => player.id));

    const ids = [...CANONICAL_BIOLOGICAL_SIGNATURES.keys()];
    const counts = { "0": 0, "1": 0, M: 0 };
    let total = 0;
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        counts[computeRevealCode(ids[left]!, ids[right]!)] += 1;
        total += 1;
      }
    }

    expect(counts).toEqual({ "0": 64, "1": 44, M: 12 });
    expect(total).toBe(120);
  });

  it("honors the five V17 comparison references and rejects missing signatures", () => {
    resetBiologicalSignaturesForTests();
    seedBiologicalSignatures(createMockPlayers().map((player) => player.id));

    expect(computeRevealCode("A1", "C1")).toBe("M");
    expect(computeRevealCode("A1", "A4")).toBe("1");
    expect(computeRevealCode("A2", "B2")).toBe("1");
    expect(computeRevealCode("A3", "D3")).toBe("1");
    expect(computeRevealCode("A2", "B3")).toBe("0");
    expect(() => computeRevealCode("ghost", "A1")).toThrow("server_signature_missing");
    expect(() => seedBiologicalSignatures(["A1", "ghost"])).toThrow("server_signature_missing");
  });
});
