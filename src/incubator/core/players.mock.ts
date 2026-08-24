import type { IncubatorPlayerPublic } from "../types";

export const CANONICAL_SUBJECT_IDS = [
  "A1", "A2", "A3", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D1", "D2", "D3", "D4",
] as const;

const ARCHIVED_INDEXES = new Set([13, 14, 15]);

export function createMockPlayers(): IncubatorPlayerPublic[] {
  return CANONICAL_SUBJECT_IDS.map((id, index) => ({
    id,
    displayName: `Sujet ${id}`,
    status: ARCHIVED_INDEXES.has(index) ? "archivé" : "actif",
  }));
}
