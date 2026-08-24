import { describe, expect, it } from "vitest";
import type { IncubatorRoomSnapshot } from "../types";
import { chamberSubjectId } from "./chamberSubjectId";

const a1 = { id: "A1", displayName: "Sujet A1", status: "actif" as const };
const a2 = { id: "A2", displayName: "Sujet A2", status: "actif" as const };

function room(
  patch: Partial<IncubatorRoomSnapshot> = {},
): IncubatorRoomSnapshot {
  return {
    id: "room-1",
    accessCode: "Z9-Z9",
    initiatorId: "A1",
    participants: [a1, a2],
    state: "WAITING",
    chambers: {},
    createdAt: "2026-08-24T08:00:00.000Z",
    updatedAt: "2026-08-24T08:00:00.000Z",
    expiresAt: "2026-08-24T08:15:00.000Z",
    ...patch,
  };
}

describe("chamberSubjectId", () => {
  it("keeps tanks empty while the second subject has not joined", () => {
    const waiting = room({ participants: [a1] });
    expect(chamberSubjectId(waiting, "left")).toBeNull();
    expect(chamberSubjectId(waiting, "right")).toBeNull();
  });

  it("places initiator left and joiner right after both codes are accepted", () => {
    const ready = room();
    expect(chamberSubjectId(ready, "left")).toBe("A1");
    expect(chamberSubjectId(ready, "right")).toBe("A2");
  });

  it("honors the initiator chamber once a fingerprint has chosen a side", () => {
    const ready = room({
      initiatorChamber: "right",
      chambers: { right: { subjectId: "A1", pressed: true } },
    });
    expect(chamberSubjectId(ready, "right")).toBe("A1");
    expect(chamberSubjectId(ready, "left")).toBe("A2");
  });
});
