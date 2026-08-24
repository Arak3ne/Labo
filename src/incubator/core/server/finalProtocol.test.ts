import { describe, expect, it } from "vitest";
import { evaluateFinalProtocol } from "./finalProtocol";

const GROUPS = ["A", "B", "C", "D"] as const;
const SUBJECTS_BY_GROUP = Object.fromEntries(
  GROUPS.map((group) => [
    group,
    [1, 2, 3, 4].map((index) => `${group}${index}`),
  ]),
) as Record<(typeof GROUPS)[number], string[]>;

describe("server final protocol", () => {
  it("finds exactly 16 STABLE combinations among all 256 group combinations", () => {
    const stable: string[][] = [];
    let total = 0;

    for (const a of SUBJECTS_BY_GROUP.A) {
      for (const b of SUBJECTS_BY_GROUP.B) {
        for (const c of SUBJECTS_BY_GROUP.C) {
          for (const d of SUBJECTS_BY_GROUP.D) {
            const combination = [a, b, c, d];
            if (evaluateFinalProtocol(combination) === "STABLE") {
              stable.push(combination);
            }
            total += 1;
          }
        }
      }
    }

    expect(total).toBe(256);
    expect(stable).toHaveLength(16);

    const memberships = Object.fromEntries(
      GROUPS.flatMap((group) =>
        SUBJECTS_BY_GROUP[group].map((subjectId) => [subjectId, 0]),
      ),
    ) as Record<string, number>;
    for (const combination of stable) {
      for (const subjectId of combination) {
        memberships[subjectId] = (memberships[subjectId] ?? 0) + 1;
      }
    }
    expect(Object.values(memberships)).toEqual(Array(16).fill(4));
  });

  it.each([
    ["A1", "B1", "C1", "D1"],
    ["A2", "B2", "C2", "D2"],
    ["A3", "B3", "C3", "D3"],
    ["A4", "B4", "C4", "D4"],
  ])("marks diagonal combination %s%s%s%s INSTABLE", (a, b, c, d) => {
    expect(evaluateFinalProtocol([a, b, c, d])).toBe("INSTABLE");
  });

  it("rejects incomplete, duplicate-group, and unknown-subject combinations", () => {
    expect(() => evaluateFinalProtocol(["A1", "B1", "C1"])).toThrow(
      "final_protocol_incomplete",
    );
    expect(() => evaluateFinalProtocol(["A1", "A2", "C1", "D1"])).toThrow(
      "final_protocol_duplicate_group",
    );
    expect(() => evaluateFinalProtocol(["A1", "B1", "C1", "ghost"])).toThrow(
      "final_protocol_subject_unknown",
    );
  });
});
