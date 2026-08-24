import type {
  IncubatorAccessCounter,
  IncubatorAccessDecision,
  IncubatorDenialReason,
  IncubatorSession,
  IncubatorSubjectId,
} from "../types";
import type { IncubatorMemoryStore } from "./store";

export function isAdminSession(session: IncubatorSession): boolean {
  return session.actor === "admin" && session.actorId.length > 0;
}

export function resolveSession(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
): IncubatorDenialReason | undefined {
  if (!session.actorId) {
    return "not_authenticated";
  }
  if (isAdminSession(session)) {
    return undefined;
  }
  if (session.actor !== "joueur" || !store.players.has(session.actorId)) {
    return "not_authenticated";
  }
  return undefined;
}

export function getAccessCounter(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
): IncubatorAccessCounter {
  if (isAdminSession(session)) {
    return { used: 0, remaining: 0 };
  }
  const counter = store.access.get(session.actorId);
  return counter ? { used: counter.used, remaining: counter.remaining } : { used: 0, remaining: 0 };
}

export function tryConsumeAccess(store: IncubatorMemoryStore, actorId: string): boolean {
  const counter = store.access.get(actorId);
  if (!counter || counter.remaining <= 0) {
    return false;
  }
  counter.used += 1;
  counter.remaining -= 1;
  return true;
}

export function consumeAccess(store: IncubatorMemoryStore, actorId: string): void {
  tryConsumeAccess(store, actorId);
}

function deny(reason: IncubatorDenialReason): IncubatorAccessDecision {
  return { allowed: false, reason };
}

function allow(): IncubatorAccessDecision {
  return { allowed: true };
}

export function authorizeOpen(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
): IncubatorAccessDecision {
  const auth = resolveSession(store, session);
  if (auth) {
    return deny(auth);
  }
  return allow();
}

export function normalizeSubjectPair(
  store: IncubatorMemoryStore,
  subjectIds: readonly IncubatorSubjectId[],
): IncubatorAccessDecision & { pair?: [IncubatorSubjectId, IncubatorSubjectId] } {
  if (subjectIds.length !== 2) {
    return deny("invalid_subject_count");
  }
  const left = subjectIds[0];
  const right = subjectIds[1];
  if (!left || !right) {
    return deny("invalid_subject_count");
  }
  if (left === right) {
    return deny("duplicate_subjects");
  }
  if (!store.players.has(left) || !store.players.has(right)) {
    return deny("unknown_subject");
  }
  return { allowed: true, pair: [left, right] };
}

export function authorizeSelect(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  subjectIds: readonly IncubatorSubjectId[],
): IncubatorAccessDecision {
  const opened = authorizeOpen(store, session);
  if (!opened.allowed) {
    return opened;
  }
  if (subjectIds.length === 0) {
    return deny("invalid_subject_count");
  }
  if (subjectIds.length === 1) {
    const only = subjectIds[0];
    if (!only || !store.players.has(only)) {
      return deny("unknown_subject");
    }
    return allow();
  }
  return normalizeSubjectPair(store, subjectIds);
}

export function authorizeLaunchAccess(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  subjectIds: readonly IncubatorSubjectId[],
): IncubatorAccessDecision {
  const selected = authorizeSelect(store, session, subjectIds);
  if (!selected.allowed) {
    return selected;
  }
  if (isAdminSession(session)) {
    return allow();
  }
  const counter = getAccessCounter(store, session);
  if (counter.remaining <= 0) {
    return deny("access_exhausted");
  }
  return allow();
}
