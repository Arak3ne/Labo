import type {
  IncubatorChamber,
  IncubatorFingerprintClient,
  IncubatorFingerprintDenialReason,
  IncubatorFingerprintResult,
  IncubatorFingerprintSnapshot,
  IncubatorFingerprintSnapshotListener,
  IncubatorFingerprintState,
  IncubatorRevealCode,
  IncubatorSubjectId,
} from "../types";

/**
 * Browser/test-only public-data mock. It demonstrates realtime transport
 * behaviour but is not an authorization boundary or a production backend.
 * In particular, it imports no server authority and contains no biological
 * signatures or reveal-code computation.
 */

export interface MockFingerprintScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}

export interface MockFingerprintHubOptions {
  now?: () => Date;
  scheduler?: MockFingerprintScheduler;
  syncDurationMs?: number;
  gracePeriodMs?: number;
  analysisDurationMs?: number;
  initialAccessAllowance?: number;
  /** Public mock outputs only; these do not model biological comparison. */
  revealCodes?: readonly IncubatorRevealCode[];
}

export interface MockFingerprintHub {
  /**
   * Binds a mock client to one identity. Production clients must instead bind
   * identity from the authenticated cookie/session on the server.
   */
  createClient(authenticatedSubjectId: IncubatorSubjectId): IncubatorFingerprintClient;
  getSnapshot(sessionId: string): IncubatorFingerprintSnapshot | undefined;
  getConsumedAccess(subjectId: IncubatorSubjectId): number;
  getSubscriberCount(sessionId: string): number;
}

interface Occupant {
  subjectId: IncubatorSubjectId;
  pressed: boolean;
}

interface SessionRecord {
  id: string;
  state: IncubatorFingerprintState;
  initiatorId: IncubatorSubjectId;
  initiatorChamber?: IncubatorChamber;
  chambers: Partial<Record<IncubatorChamber, Occupant>>;
  runId?: string;
  result?: IncubatorRevealCode;
  createdAt: string;
  updatedAt: string;
  cancelSync?: () => void;
  cancelAnalysis?: () => void;
  graceCancels: Partial<Record<IncubatorChamber, () => void>>;
  listeners: Set<IncubatorFingerprintSnapshotListener>;
}

const defaultScheduler: MockFingerprintScheduler = {
  schedule(callback, delayMs) {
    const timer = globalThis.setTimeout(callback, delayMs);
    return () => globalThis.clearTimeout(timer);
  },
};

const TERMINAL_STATES = new Set<IncubatorFingerprintState>(["RESOLVED", "CANCELLED"]);

function deny(reason: IncubatorFingerprintDenialReason): IncubatorFingerprintResult {
  return { ok: false, reason };
}

function snapshotOf(record: SessionRecord): IncubatorFingerprintSnapshot {
  const left = record.chambers.left;
  const right = record.chambers.right;
  const chambers = Object.freeze({
    ...(left
      ? { left: Object.freeze({ subjectId: left.subjectId, pressed: left.pressed }) }
      : {}),
    ...(right
      ? { right: Object.freeze({ subjectId: right.subjectId, pressed: right.pressed }) }
      : {}),
  });
  return Object.freeze({
    id: record.id,
    state: record.state,
    initiatorId: record.initiatorId,
    ...(record.initiatorChamber ? { initiatorChamber: record.initiatorChamber } : {}),
    chambers,
    ...(record.runId ? { runId: record.runId } : {}),
    ...(record.result ? { result: record.result } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function createMockFingerprintHub(
  options: MockFingerprintHubOptions = {},
): MockFingerprintHub {
  const scheduler = options.scheduler ?? defaultScheduler;
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const syncDurationMs = options.syncDurationMs ?? 1_800;
  const gracePeriodMs = options.gracePeriodMs ?? 150;
  const analysisDurationMs = options.analysisDurationMs ?? 250;
  const initialAccessAllowance = options.initialAccessAllowance ?? 1;
  const revealCodes =
    options.revealCodes && options.revealCodes.length > 0
      ? [...options.revealCodes]
      : (["M", "0", "1"] satisfies IncubatorRevealCode[]);
  const sessions = new Map<string, SessionRecord>();
  const consumedAccess = new Map<IncubatorSubjectId, number>();
  let sessionSerial = 0;
  let runSerial = 0;
  let revealCursor = 0;

  function publish(record: SessionRecord): IncubatorFingerprintSnapshot {
    record.updatedAt = now();
    const snapshot = snapshotOf(record);
    for (const listener of record.listeners) listener(snapshot);
    return snapshot;
  }

  function success(record: SessionRecord): IncubatorFingerprintResult {
    return { ok: true, snapshot: snapshotOf(record) };
  }

  function clearTimers(record: SessionRecord): void {
    record.cancelSync?.();
    record.cancelSync = undefined;
    record.cancelAnalysis?.();
    record.cancelAnalysis = undefined;
    for (const chamber of ["left", "right"] as const) {
      record.graceCancels[chamber]?.();
      delete record.graceCancels[chamber];
    }
  }

  function stateFromPresses(record: SessionRecord): IncubatorFingerprintState {
    const pressed =
      (record.chambers.left?.pressed ? 1 : 0)
      + (record.chambers.right?.pressed ? 1 : 0);
    if (pressed === 2) return "SYNCING";
    return pressed === 1 ? "ONE_FINGERPRINT" : "WAITING";
  }

  function consumeOnce(initiatorId: IncubatorSubjectId): boolean {
    const used = consumedAccess.get(initiatorId) ?? 0;
    if (used >= initialAccessAllowance) return false;
    consumedAccess.set(initiatorId, used + 1);
    return true;
  }

  function validateSync(record: SessionRecord): void {
    record.cancelSync = undefined;
    const left = record.chambers.left;
    const right = record.chambers.right;
    if (
      record.state !== "SYNCING"
      || !left?.pressed
      || !right?.pressed
    ) return;
    if (record.graceCancels.left || record.graceCancels.right) {
      record.cancelSync = scheduler.schedule(() => validateSync(record), gracePeriodMs);
      return;
    }

    if (!consumeOnce(record.initiatorId)) {
      record.state = "CANCELLED";
      clearTimers(record);
      publish(record);
      return;
    }

    record.runId = `mock-run-${++runSerial}`;
    record.result = revealCodes[revealCursor++ % revealCodes.length];
    record.state = "ANALYZING";
    record.cancelSync = undefined;
    for (const chamber of ["left", "right"] as const) {
      record.graceCancels[chamber]?.();
      delete record.graceCancels[chamber];
    }
    publish(record);
    record.cancelAnalysis = scheduler.schedule(() => {
      record.cancelAnalysis = undefined;
      if (record.state !== "ANALYZING") return;
      record.state = "RESOLVED";
      publish(record);
    }, analysisDurationMs);
  }

  function refreshProgress(record: SessionRecord): IncubatorFingerprintSnapshot {
    const nextState = stateFromPresses(record);
    if (nextState !== "SYNCING") {
      record.cancelSync?.();
      record.cancelSync = undefined;
    }
    record.state = nextState;
    if (nextState === "SYNCING" && !record.cancelSync) {
      record.cancelSync = scheduler.schedule(() => validateSync(record), syncDurationMs);
    }
    return publish(record);
  }

  function openRecord(sessionId: string | undefined): SessionRecord | IncubatorFingerprintDenialReason {
    if (!sessionId) return "unknown_session";
    const record = sessions.get(sessionId);
    if (!record) return "unknown_session";
    if (TERMINAL_STATES.has(record.state) || record.state === "ANALYZING") {
      return "session_closed";
    }
    return record;
  }

  function createClient(authenticatedSubjectId: IncubatorSubjectId): IncubatorFingerprintClient {
    let joinedSessionId: string | undefined;

    async function mutate(
      chamber: IncubatorChamber,
      action: "press" | "release",
    ): Promise<IncubatorFingerprintResult> {
      const open = openRecord(joinedSessionId);
      if (typeof open === "string") return deny(open);
      const otherChamber: IncubatorChamber = chamber === "left" ? "right" : "left";
      const occupant = open.chambers[chamber];

      if (action === "press") {
        if (open.chambers[otherChamber]?.subjectId === authenticatedSubjectId) {
          return deny("subject_already_present");
        }
        if (occupant && occupant.subjectId !== authenticatedSubjectId) {
          return deny("chamber_occupied");
        }
        const active = occupant ?? { subjectId: authenticatedSubjectId, pressed: false };
        open.chambers[chamber] = active;
        if (authenticatedSubjectId === open.initiatorId && !open.initiatorChamber) {
          open.initiatorChamber = chamber;
        }
        open.graceCancels[chamber]?.();
        delete open.graceCancels[chamber];
        if (active.pressed) return success(open);
        active.pressed = true;
        return { ok: true, snapshot: refreshProgress(open) };
      }

      if (!occupant) return success(open);
      if (occupant.subjectId !== authenticatedSubjectId) return deny("access_denied");
      if (!occupant.pressed || open.graceCancels[chamber]) return success(open);
      open.graceCancels[chamber] = scheduler.schedule(() => {
        delete open.graceCancels[chamber];
        // Keep ownership after detection stops; safe reuse needs an explicit,
        // authenticated leave operation outside synchronization.
        occupant.pressed = false;
        refreshProgress(open);
      }, gracePeriodMs);
      return success(open);
    }

    return {
      async createSession() {
        if ((consumedAccess.get(authenticatedSubjectId) ?? 0) >= initialAccessAllowance) {
          return deny("access_exhausted");
        }
        const timestamp = now();
        const record: SessionRecord = {
          id: `mock-fingerprint-${++sessionSerial}`,
          state: "WAITING",
          initiatorId: authenticatedSubjectId,
          chambers: {},
          createdAt: timestamp,
          updatedAt: timestamp,
          graceCancels: {},
          listeners: new Set(),
        };
        sessions.set(record.id, record);
        joinedSessionId = record.id;
        return success(record);
      },

      async joinSession(sessionId) {
        const record = sessions.get(sessionId);
        if (!record) return deny("unknown_session");
        joinedSessionId = sessionId;
        return success(record);
      },

      getSnapshot() {
        if (!joinedSessionId) return undefined;
        const record = sessions.get(joinedSessionId);
        return record ? snapshotOf(record) : undefined;
      },

      async getAccessCounter() {
        const used = consumedAccess.get(authenticatedSubjectId) ?? 0;
        return {
          used,
          remaining: Math.max(0, initialAccessAllowance - used),
        };
      },

      subscribe(listener) {
        if (!joinedSessionId) return () => undefined;
        const record = sessions.get(joinedSessionId);
        if (!record) return () => undefined;
        record.listeners.add(listener);
        listener(snapshotOf(record));
        return () => {
          record.listeners.delete(listener);
        };
      },

      press(chamber) {
        return mutate(chamber, "press");
      },

      release(chamber) {
        return mutate(chamber, "release");
      },

      disconnect(chamber) {
        return mutate(chamber, "release");
      },

      async cancel() {
        if (!joinedSessionId) return deny("unknown_session");
        const record = sessions.get(joinedSessionId);
        if (!record) return deny("unknown_session");
        if (record.initiatorId !== authenticatedSubjectId) return deny("access_denied");
        if (record.state === "RESOLVED") return deny("session_closed");
        if (record.state === "CANCELLED") return success(record);
        record.state = "CANCELLED";
        clearTimers(record);
        return { ok: true, snapshot: publish(record) };
      },
    };
  }

  return {
    createClient,
    getSnapshot(sessionId) {
      const record = sessions.get(sessionId);
      return record ? snapshotOf(record) : undefined;
    },
    getConsumedAccess(subjectId) {
      return consumedAccess.get(subjectId) ?? 0;
    },
    getSubscriberCount(sessionId) {
      return sessions.get(sessionId)?.listeners.size ?? 0;
    },
  };
}
