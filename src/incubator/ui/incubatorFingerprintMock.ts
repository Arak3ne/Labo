import { createMockFingerprintHub } from "../core/mockFingerprintTransport";
import type {
  IncubatorFingerprintSnapshot,
  IncubatorPlayerPublic,
  IncubatorRoomSnapshot,
  IncubatorServerFingerprintClient,
  IncubatorSubjectId,
} from "../types";

export function createMockRoomFingerprintClient(
  subjectId: IncubatorSubjectId,
): IncubatorServerFingerprintClient {
  const base = createMockFingerprintHub({ analysisDurationMs: 250 }).createClient(subjectId);
  const player: IncubatorPlayerPublic = {
    id: subjectId,
    displayName: subjectId,
    status: "actif",
  };
  let accessCode = "";

  const room = (snapshot: IncubatorFingerprintSnapshot): IncubatorRoomSnapshot => ({
    ...snapshot,
    accessCode: accessCode || snapshot.id,
    participants: [player],
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  const result = async (request: Promise<Awaited<ReturnType<typeof base.createSession>>>) => {
    const next = await request;
    return next.ok ? { ok: true as const, snapshot: room(next.snapshot) } : next;
  };

  return {
    async createSession(code) {
      accessCode = code;
      const next = await result(base.createSession(code));
      return next.ok ? { ok: true, snapshot: room(next.snapshot) } : next;
    },
    joinSession(code) {
      accessCode = code;
      return result(base.joinSession(code));
    },
    getSnapshot() {
      const snapshot = base.getSnapshot();
      return snapshot ? room(snapshot) : undefined;
    },
    refreshSnapshot() {
      const snapshot = base.getSnapshot();
      return Promise.resolve(snapshot
        ? { ok: true, snapshot: room(snapshot) }
        : { ok: false, reason: "unknown_session" });
    },
    getAccessCounter: base.getAccessCounter,
    subscribe(listener) {
      return base.subscribe((snapshot) => listener(room(snapshot)));
    },
    subscribeTransport() {
      return () => undefined;
    },
    press(chamber) {
      return result(base.press(chamber));
    },
    release(chamber) {
      return result(base.release(chamber));
    },
    disconnect(chamber) {
      return result(base.disconnect(chamber));
    },
    cancel() {
      return result(base.cancel());
    },
    destroy() {
      base.destroy?.();
    },
  };
}
