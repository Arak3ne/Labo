import type { IncubatorPublicConfig } from "../types";

/** Numeric archive-selection cost for UI display. Not an ADN rule. */
export const ARCHIVE_SELECTION_COST = 1;

/** Initial remaining launches on the server access counter. */
export const DEFAULT_ACCESS_ALLOWANCE = 3;

export function createPublicConfig(
  archiveSelectionCost = ARCHIVE_SELECTION_COST,
): IncubatorPublicConfig {
  return { archiveSelectionCost };
}
