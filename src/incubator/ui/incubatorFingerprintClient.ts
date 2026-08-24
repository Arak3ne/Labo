import { createServerFingerprintClient } from "../core/serverFingerprintClient";
import type { IncubatorServerFingerprintClient, IncubatorSubjectId } from "../types";

export async function resolveIncubatorFingerprintClient(
  authenticatedSubjectId: IncubatorSubjectId,
): Promise<IncubatorServerFingerprintClient> {
  if (import.meta.env.VITE_INCUBATOR_USE_MOCK === "true") {
    const { createMockRoomFingerprintClient } = await import("./incubatorFingerprintMock");
    return createMockRoomFingerprintClient(authenticatedSubjectId);
  }
  return createServerFingerprintClient();
}
