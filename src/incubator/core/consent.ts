import type {
  IncubatorConsentRecord,
  IncubatorConsentStance,
  IncubatorDenialReason,
  IncubatorSession,
  IncubatorSubjectId,
} from "../types";
import { isAdminSession } from "./access.js";
import type { IncubatorMemoryStore } from "./store.js";
import { cloneConsent } from "./store.js";

function partyIds(
  operatorId: string,
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId],
): string[] {
  return [...new Set([operatorId, subjectIds[0], subjectIds[1]])];
}

function emptyDecisions(ids: string[]): Record<string, IncubatorConsentStance> {
  const decisions: Record<string, IncubatorConsentStance> = {};
  for (const id of ids) {
    decisions[id] = "pending";
  }
  return decisions;
}

export function createConsentRecord(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId],
  now: string,
): IncubatorConsentRecord {
  const record: IncubatorConsentRecord = {
    id: store.nextId("consent"),
    operatorId: session.actorId,
    subjectIds: [subjectIds[0], subjectIds[1]],
    decisions: emptyDecisions(partyIds(session.actorId, subjectIds)),
    createdAt: now,
  };
  store.consents.set(record.id, record);
  return cloneConsent(record);
}

export function setConsentStance(
  store: IncubatorMemoryStore,
  consentId: string,
  partyId: string,
  stance: Exclude<IncubatorConsentStance, "pending">,
): IncubatorConsentRecord | undefined {
  const record = store.consents.get(consentId);
  if (!record || !(partyId in record.decisions)) {
    return undefined;
  }
  record.decisions[partyId] = stance;
  return cloneConsent(record);
}

export function forceConsentAccepted(
  store: IncubatorMemoryStore,
  consentId: string,
): IncubatorConsentRecord | undefined {
  const record = store.consents.get(consentId);
  if (!record) {
    return undefined;
  }
  for (const partyId of Object.keys(record.decisions)) {
    record.decisions[partyId] = "accepted";
  }
  return cloneConsent(record);
}

export function sameSubjectPair(
  left: readonly [string, string],
  right: readonly [string, string],
): boolean {
  return (
    (left[0] === right[0] && left[1] === right[1]) ||
    (left[0] === right[1] && left[1] === right[0])
  );
}

export function evaluateConsent(
  record: IncubatorConsentRecord,
): "complete" | "incomplete" | "refused" {
  const stances = Object.values(record.decisions);
  if (stances.some((stance) => stance === "refused")) {
    return "refused";
  }
  if (stances.some((stance) => stance !== "accepted")) {
    return "incomplete";
  }
  return "complete";
}

export function authorizeConsentForLaunch(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId],
  consentId: string | undefined,
  ignoreConsent: boolean,
): { reason?: IncubatorDenialReason; consentIds: string[] } {
  if (ignoreConsent) {
    if (!isAdminSession(session)) {
      return { reason: "admin_required", consentIds: [] };
    }
    return { consentIds: [] };
  }

  if (!consentId) {
    return { reason: "consent_required", consentIds: [] };
  }

  const record = store.consents.get(consentId);
  if (!record) {
    return { reason: "consent_required", consentIds: [] };
  }

  if (!sameSubjectPair(record.subjectIds, subjectIds)) {
    return { reason: "consent_mismatch", consentIds: [] };
  }

  if (!isAdminSession(session) && record.operatorId !== session.actorId) {
    return { reason: "consent_mismatch", consentIds: [] };
  }

  const state = evaluateConsent(record);
  if (state === "refused") {
    return { reason: "consent_refused", consentIds: [] };
  }
  if (state === "incomplete") {
    return { reason: "consent_incomplete", consentIds: [] };
  }

  return { consentIds: [record.id] };
}

export function canActOnConsent(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  consentId: string,
): boolean {
  if (isAdminSession(session)) {
    return store.consents.has(consentId);
  }
  const record = store.consents.get(consentId);
  return Boolean(record && session.actorId in record.decisions);
}
