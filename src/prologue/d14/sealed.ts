import { fingerprintsEqual, sha256Hex } from "./digest";

/** Fingerprints only. Answers are not present in the client bundle. */
const PATTERN_FINGERPRINT =
  "a1b5fa31fdf1d82d0f87ce3c8962dc732532864385e7fd6595ce17d1de252d4f";
const HOST_FINGERPRINT =
  "4968176e14c5bf78041fd9f03d7aeaf6dfe41fd5ab6187d21334ad231f07e087";

function seal(kind: "pattern" | "host", value: string): string {
  return sha256Hex(`d14.${kind}.v1:${value}`);
}

export function patternsMatch(input: readonly number[]): boolean {
  return fingerprintsEqual(seal("pattern", input.join(",")), PATTERN_FINGERPRINT);
}

export function hostMatches(input: string): boolean {
  return fingerprintsEqual(seal("host", input), HOST_FINGERPRINT);
}
