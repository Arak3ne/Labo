import type {
  CorrectRunInput,
  IncubatorConsentRecord,
  IncubatorDenialReason,
  IncubatorRunRecord,
  IncubatorSession,
} from "../../types";
import { isAdminSession, normalizeSubjectPair } from "../access";
import { forceConsentAccepted } from "../consent";
import type { IncubatorMemoryStore } from "../store";
import { cloneRun } from "../store";

export function requireAdmin(session: IncubatorSession): IncubatorDenialReason | undefined {
  if (!isAdminSession(session)) {
    return "admin_required";
  }
  return undefined;
}

export function adminForceConsent(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  consentId: string,
): { record?: IncubatorConsentRecord; reason?: IncubatorDenialReason } {
  const denied = requireAdmin(session);
  if (denied) {
    return { reason: denied };
  }
  const record = forceConsentAccepted(store, consentId);
  if (!record) {
    return { reason: "consent_required" };
  }
  return { record };
}

export function adminCorrectRun(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  runId: string,
  patch: CorrectRunInput,
): { run?: IncubatorRunRecord; reason?: IncubatorDenialReason } {
  const denied = requireAdmin(session);
  if (denied) {
    return { reason: denied };
  }

  const run = store.runs.find((entry) => entry.id === runId);
  if (!run) {
    return { reason: "unknown_run" };
  }

  if (patch.code !== undefined) {
    run.code = patch.code;
  }

  if (patch.subjectIds) {
    const pair = normalizeSubjectPair(store, patch.subjectIds);
    if (!pair.allowed || !pair.pair) {
      return { reason: pair.reason ?? "unknown_subject" };
    }
    run.subjectIds = pair.pair;
  }

  if (patch.consentIds) {
    run.consentIds = [...patch.consentIds];
  }

  return { run: cloneRun(run) };
}
