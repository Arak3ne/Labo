/**
 * Server-only biological signatures.
 * Never import this module from UI, scene, audio, or public type barrels.
 */

export type BiologicalAllele = "α" | "β" | "γ" | "δ";
export type BiologicalSignature = readonly [BiologicalAllele, BiologicalAllele];

const signatures = new Map<string, BiologicalSignature>();

export const CANONICAL_BIOLOGICAL_SIGNATURES: ReadonlyMap<string, BiologicalSignature> =
  new Map([
    ["A1", ["γ", "α"]],
    ["A2", ["δ", "β"]],
    ["A3", ["β", "δ"]],
    ["A4", ["γ", "α"]],
    ["B1", ["δ", "γ"]],
    ["B2", ["δ", "α"]],
    ["B3", ["β", "γ"]],
    ["B4", ["α", "β"]],
    ["C1", ["α", "γ"]],
    ["C2", ["α", "γ"]],
    ["C3", ["γ", "β"]],
    ["C4", ["α", "δ"]],
    ["D1", ["δ", "β"]],
    ["D2", ["β", "δ"]],
    ["D3", ["γ", "δ"]],
    ["D4", ["β", "α"]],
  ] satisfies ReadonlyArray<readonly [string, BiologicalSignature]>);

export function seedBiologicalSignatures(playerIds: readonly string[]): void {
  signatures.clear();
  for (const id of playerIds) {
    const signature = CANONICAL_BIOLOGICAL_SIGNATURES.get(id);
    if (!signature) throw new Error("server_signature_missing");
    signatures.set(id, signature);
  }
}

export function resetBiologicalSignaturesForTests(): void {
  signatures.clear();
}

export function readSignatureForCompare(id: string): BiologicalSignature | undefined {
  return signatures.get(id);
}
