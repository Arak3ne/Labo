import type { IncubatorDenialReason } from "../types";
import type { IncubatorUiErrorKind } from "./incubatorUiTypes";

export function mapCoreDenial(reason: IncubatorDenialReason | undefined): IncubatorUiErrorKind {
  switch (reason) {
    case "invalid_subject_count":
    case "duplicate_subjects":
    case "unknown_subject":
      return "invalid_selection";
    case "consent_refused":
      return "consent_refused";
    case "consent_required":
    case "consent_incomplete":
    case "consent_mismatch":
      return "consent_missing";
    default:
      return "access_denied";
  }
}
