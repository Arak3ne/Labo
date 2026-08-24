import type { IncubatorChamber, IncubatorRoomSnapshot } from "../types";

export function chamberSubjectId(
  snapshot: IncubatorRoomSnapshot | undefined,
  side: IncubatorChamber,
): string | null {
  const occupant = snapshot?.chambers[side];
  if (occupant) return occupant.subjectId;
  const participants = snapshot?.participants ?? [];
  if (participants.length !== 2) return null;
  const initiatorId = snapshot?.initiatorId;
  const initiator = participants.find((participant) => participant.id === initiatorId)
    ?? participants[0];
  const other = participants.find((participant) => participant.id !== initiator.id)
    ?? participants[1];
  if (!initiator || !other) return null;
  const initiatorSide = snapshot?.initiatorChamber ?? "left";
  return side === initiatorSide ? initiator.id : other.id;
}
