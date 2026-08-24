import type { IncubatorRevealCode } from "../../types";
import {
  readSignatureForCompare,
  type BiologicalSignature,
} from "./signatures.js";

function isReverseMatch(
  left: BiologicalSignature,
  right: BiologicalSignature,
): boolean {
  return left[0] !== left[1] && left[0] === right[1] && left[1] === right[0];
}

/** Server-only. Returns the public code; never the signatures. */
export function computeRevealCode(
  leftId: string,
  rightId: string,
): IncubatorRevealCode {
  const left = readSignatureForCompare(leftId);
  const right = readSignatureForCompare(rightId);

  if (!left || !right) {
    throw new Error("server_signature_missing");
  }

  if (isReverseMatch(left, right)) {
    return "M";
  }

  if (left[0] === right[0] || left[1] === right[1]) {
    return "1";
  }

  return "0";
}
