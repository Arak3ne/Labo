import type {
  IncubatorChamber,
  IncubatorFingerprintDenialReason,
  IncubatorFingerprintResult,
  IncubatorFingerprintSnapshot,
  IncubatorFingerprintState,
  IncubatorRevealCode,
  IncubatorRunRecord,
  IncubatorSession,
} from "../../types";
import { getAccessCounter, isAdminSession, resolveSession, tryConsumeAccess } from "../access";
import { createConsentRecord, setConsentStance } from "../consent";
import type { IncubatorMemoryStore } from "../store";
import { cloneRun } from "../store";
import { computeRevealCode } from "./compare";

export interface IncubatorFingerprintScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}

export interface FingerprintSessionAuthorityOptions {
  store: IncubatorMemoryStore;
  now?: () => Date;
  scheduler?: IncubatorFingerprintScheduler;
  syncDurationMs?: number;
  gracePeriodMs?: number;
  compare?: (leftId: string, rightId: string) => IncubatorRevealCode;
  authorizeAnalysis?: (sessionId: string) => boolean;
}

export interface FingerprintSessionAuthority {
  createSession(authenticated: IncubatorSession): IncubatorFingerprintResult;
  press(
    sessionId: string,
    authenticated: IncubatorSession,
    chamber: IncubatorChamber,
  ): IncubatorFingerprintResult;
  release(
    sessionId: string,
    authenticated: IncubatorSession,
    chamber: IncubatorChamber,
  ): IncubatorFingerprintResult;
  disconnect(
    sessionId: string,
    authenticated: IncubatorSession,
    chamber: IncubatorChamber,
  ): IncubatorFingerprintResult;
  resolve(sessionId: string): IncubatorFingerprintResult;
  cancel(
    sessionId: string,
    authenticated: IncubatorSession,
  ): IncubatorFingerprintResult;
  getSnapshot(sessionId: string): IncubatorFingerprintSnapshot | undefined;
  subscribe(
    sessionId: string,
    listener: (snapshot: IncubatorFingerprintSnapshot) => void,
  ): () => void;
}

interface Occupant {
  subjectId: string;
  pressed: boolean;
}

interface FingerprintSessionRecord {
  id: string;
  state: IncubatorFingerprintState;
  initiatorId: string;
  initiatorChamber?: IncubatorChamber;
  chambers: Partial<Record<IncubatorChamber, Occupant>>;
  runId?: string;
  result?: IncubatorRevealCode;
  createdAt: string;
  updatedAt: string;
  cancelSync?: () => void;
  graceCancels: Partial<Record<IncubatorChamber, () => void>>;
  listeners: Set<(snapshot: IncubatorFingerprintSnapshot) => void>;
}

const TERMINAL_STATES = new Set<IncubatorFingerprintState>(["RESOLVED", "CANCELLED"]);

const defaultScheduler: IncubatorFingerprintScheduler = {
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

function deny(reason: IncubatorFingerprintDenialReason): IncubatorFingerprintResult {
  return { ok: false, reason };
}

function snapshotOf(record: FingerprintSessionRecord): IncubatorFingerprintSnapshot {
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

export function createFingerprintSessionAuthority(
  options: FingerprintSessionAuthorityOptions,
): FingerprintSessionAuthority {
  const { store } = options;
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const scheduler = options.scheduler ?? defaultScheduler;
  const syncDurationMs = options.syncDurationMs ?? 1_800;
  const gracePeriodMs = options.gracePeriodMs ?? 150;
  const compare = options.compare ?? computeRevealCode;
  const sessions = new Map<string, FingerprintSessionRecord>();

  function publish(record: FingerprintSessionRecord): IncubatorFingerprintSnapshot {
    record.updatedAt = now();
    const snapshot = snapshotOf(record);
    for (const listener of record.listeners) {
      listener(snapshot);
    }
    return snapshot;
  }

  function success(record: FingerprintSessionRecord): IncubatorFingerprintResult {
    return { ok: true, snapshot: snapshotOf(record) };
  }

  function authenticatePlayer(authenticated: IncubatorSession): IncubatorFingerprintDenialReason | undefined {
    const denied = resolveSession(store, authenticated);
    if (denied) {
      return denied === "not_authenticated" ? denied : "access_denied";
    }
    if (isAdminSession(authenticated)) {
      return "access_denied";
    }
    return undefined;
  }

  function clearTimers(record: FingerprintSessionRecord): void {
    record.cancelSync?.();
    record.cancelSync = undefined;
    for (const chamber of ["left", "right"] as const) {
      record.graceCancels[chamber]?.();
      delete record.graceCancels[chamber];
    }
  }

  function stateFromPresses(record: FingerprintSessionRecord): IncubatorFingerprintState {
    const count =
      (record.chambers.left?.pressed ? 1 : 0)
      + (record.chambers.right?.pressed ? 1 : 0);
    if (count === 2) {
      return "SYNCING";
    }
    return count === 1 ? "ONE_FINGERPRINT" : "WAITING";
  }

  function validateSync(record: FingerprintSessionRecord): void {
    record.cancelSync = undefined;
    const left = record.chambers.left;
    const right = record.chambers.right;
    if (
      record.state !== "SYNCING"
      || !left?.pressed
      || !right?.pressed
    ) {
      return;
    }
    if (record.graceCancels.left || record.graceCancels.right) {
      record.cancelSync = scheduler.schedule(() => validateSync(record), gracePeriodMs);
      return;
    }

    const code = compare(left.subjectId, right.subjectId);
    const accessAuthorized = (() => {
      try {
        return options.authorizeAnalysis
          ? options.authorizeAnalysis(record.id)
          : tryConsumeAccess(store, record.initiatorId);
      } catch {
        return false;
      }
    })();
    if (!accessAuthorized) {
      record.state = "CANCELLED";
      clearTimers(record);
      publish(record);
      return;
    }

    const timestamp = now();
    const consent = createConsentRecord(
      store,
      { actor: "joueur", actorId: record.initiatorId },
      [left.subjectId, right.subjectId],
      timestamp,
    );
    setConsentStance(store, consent.id, left.subjectId, "accepted");
    setConsentStance(store, consent.id, right.subjectId, "accepted");
    const run: IncubatorRunRecord = {
      id: store.nextId("run"),
      subjectIds: [left.subjectId, right.subjectId],
      code,
      timestamp,
      actor: "joueur",
      actorId: record.initiatorId,
      consentIds: [consent.id],
    };
    store.runs.push(run);
    record.runId = run.id;
    record.result = code;
    record.state = "ANALYZING";
    clearTimers(record);
    publish(record);
  }

  function refreshProgress(record: FingerprintSessionRecord): IncubatorFingerprintSnapshot {
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

  function getOpen(sessionId: string): FingerprintSessionRecord | IncubatorFingerprintDenialReason {
    const record = sessions.get(sessionId);
    if (!record) {
      return "unknown_session";
    }
    if (TERMINAL_STATES.has(record.state) || record.state === "ANALYZING") {
      return "session_closed";
    }
    return record;
  }

  function releaseWithGrace(
    sessionId: string,
    authenticated: IncubatorSession,
    chamber: IncubatorChamber,
  ): IncubatorFingerprintResult {
    const authDenied = authenticatePlayer(authenticated);
    if (authDenied) {
      return deny(authDenied);
    }
    const open = getOpen(sessionId);
    if (typeof open === "string") {
      return deny(open);
    }
    const occupant = open.chambers[chamber];
    if (!occupant) {
      return success(open);
    }
    if (occupant.subjectId !== authenticated.actorId) {
      return deny("access_denied");
    }
    if (!occupant.pressed || open.graceCancels[chamber]) {
      return success(open);
    }

    open.graceCancels[chamber] = scheduler.schedule(() => {
      delete open.graceCancels[chamber];
      // A release ends fingerprint detection but deliberately retains occupancy.
      // Reuse would require a separate authenticated "leave chamber" command,
      // allowed only outside synchronization, to prevent an unsafe takeover.
      occupant.pressed = false;
      refreshProgress(open);
    }, gracePeriodMs);
    return success(open);
  }

  return {
    createSession(authenticated) {
      const authDenied = authenticatePlayer(authenticated);
      if (authDenied) {
        return deny(authDenied);
      }
      if (
        !options.authorizeAnalysis
        && getAccessCounter(store, authenticated).remaining < 1
      ) {
        return deny("access_exhausted");
      }
      const timestamp = now();
      const record: FingerprintSessionRecord = {
        id: store.nextId("fingerprint"),
        state: "WAITING",
        initiatorId: authenticated.actorId,
        chambers: {},
        createdAt: timestamp,
        updatedAt: timestamp,
        graceCancels: {},
        listeners: new Set(),
      };
      sessions.set(record.id, record);
      return success(record);
    },

    press(sessionId, authenticated, chamber) {
      const authDenied = authenticatePlayer(authenticated);
      if (authDenied) {
        return deny(authDenied);
      }
      const open = getOpen(sessionId);
      if (typeof open === "string") {
        return deny(open);
      }

      const otherChamber: IncubatorChamber = chamber === "left" ? "right" : "left";
      if (open.chambers[otherChamber]?.subjectId === authenticated.actorId) {
        return deny("subject_already_present");
      }
      const occupant = open.chambers[chamber];
      if (occupant && occupant.subjectId !== authenticated.actorId) {
        return deny("chamber_occupied");
      }

      const activeOccupant = occupant ?? { subjectId: authenticated.actorId, pressed: false };
      open.chambers[chamber] = activeOccupant;
      if (authenticated.actorId === open.initiatorId && !open.initiatorChamber) {
        open.initiatorChamber = chamber;
      }
      open.graceCancels[chamber]?.();
      delete open.graceCancels[chamber];
      if (activeOccupant.pressed) {
        return success(open);
      }
      activeOccupant.pressed = true;
      return { ok: true, snapshot: refreshProgress(open) };
    },

    release: releaseWithGrace,
    disconnect: releaseWithGrace,

    resolve(sessionId) {
      const record = sessions.get(sessionId);
      if (!record) {
        return deny("unknown_session");
      }
      if (record.state === "RESOLVED") {
        return success(record);
      }
      if (record.state !== "ANALYZING") {
        return deny("invalid_state");
      }
      record.state = "RESOLVED";
      clearTimers(record);
      return { ok: true, snapshot: publish(record) };
    },

    cancel(sessionId, authenticated) {
      const record = sessions.get(sessionId);
      if (!record) {
        return deny("unknown_session");
      }
      if (
        !isAdminSession(authenticated)
        && (authenticatePlayer(authenticated) || authenticated.actorId !== record.initiatorId)
      ) {
        return deny("access_denied");
      }
      if (record.state === "CANCELLED") {
        return success(record);
      }
      if (record.state === "RESOLVED") {
        return deny("session_closed");
      }
      record.state = "CANCELLED";
      clearTimers(record);
      return { ok: true, snapshot: publish(record) };
    },

    getSnapshot(sessionId) {
      const record = sessions.get(sessionId);
      return record ? snapshotOf(record) : undefined;
    },

    subscribe(sessionId, listener) {
      const record = sessions.get(sessionId);
      if (!record) {
        return () => undefined;
      }
      record.listeners.add(listener);
      listener(snapshotOf(record));
      return () => record.listeners.delete(listener);
    },
  };
}

export function getFingerprintRun(
  store: IncubatorMemoryStore,
  runId: string,
): IncubatorRunRecord | undefined {
  const run = store.runs.find((candidate) => candidate.id === runId);
  return run ? cloneRun(run) : undefined;
}
