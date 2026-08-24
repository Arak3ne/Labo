import {
  CANONICAL_BIOLOGICAL_SIGNATURES,
  type BiologicalAllele,
} from "./signatures";

export type FinalProtocolResult = "STABLE" | "INSTABLE";

const GROUPS = ["A", "B", "C", "D"] as const;
const ALLELES = ["α", "β", "γ", "δ"] as const;

/**
 * Server-only final protocol evaluator.
 * The combination must contain exactly one canonical subject from each group.
 */
export function evaluateFinalProtocol(
  subjectIds: readonly string[],
): FinalProtocolResult {
  if (subjectIds.length !== GROUPS.length) {
    throw new Error("final_protocol_incomplete");
  }

  const seenGroups = new Set<string>();
  const counts: Record<BiologicalAllele, number> = {
    α: 0,
    β: 0,
    γ: 0,
    δ: 0,
  };

  for (const subjectId of subjectIds) {
    const signature = CANONICAL_BIOLOGICAL_SIGNATURES.get(subjectId);
    if (!signature) {
      throw new Error("final_protocol_subject_unknown");
    }

    const group = subjectId[0]!;
    if (seenGroups.has(group)) {
      throw new Error("final_protocol_duplicate_group");
    }
    seenGroups.add(group);

    counts[signature[0]] += 1;
    counts[signature[1]] += 1;
  }

  if (GROUPS.some((group) => !seenGroups.has(group))) {
    throw new Error("final_protocol_incomplete");
  }

  return ALLELES.every((allele) => counts[allele] === 2)
    ? "STABLE"
    : "INSTABLE";
}
