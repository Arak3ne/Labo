import type { IncubatorCoreApi } from "../core";
import type {
  IncubatorConsentRecord,
  IncubatorRunRecord,
  IncubatorSession,
  IncubatorSubjectId,
} from "../types";
import { mapCoreDenial } from "./mapCoreDenial";
import type {
  IncubatorConsentPreview,
  IncubatorCoreClient,
  IncubatorHistoryEntry,
  IncubatorSubjectCard,
} from "./incubatorUiTypes";

const OPERATOR_SESSION: IncubatorSession = {
  actorId: "A1",
  actor: "joueur",
};

function asSubject(player: { id: string; displayName: string; status: "actif" | "archivé" }): IncubatorSubjectCard {
  return {
    id: player.id,
    label: player.displayName,
    status: player.status,
  };
}

function asHistory(run: IncubatorRunRecord): IncubatorHistoryEntry {
  return {
    id: run.id,
    subjectIds: [...run.subjectIds],
    code: run.code,
    at: run.timestamp,
    actor: { id: run.actorId, kind: run.actor },
    consentId: run.consentIds[0] ?? "",
  };
}

function asConsent(record: IncubatorConsentRecord): IncubatorConsentPreview {
  const granted = Object.values(record.decisions).every((stance) => stance === "accepted");
  return {
    id: record.id,
    subjectIds: [...record.subjectIds],
    granted,
    decisions: { ...record.decisions },
  };
}

function partySession(actorId: string): IncubatorSession {
  return { actorId, actor: "joueur" };
}

export function wrapIncubatorCore(api: IncubatorCoreApi): IncubatorCoreClient {
  return {
    source: "core",
    archiveCost: api.archiveSelectionCost,
    operator: { id: OPERATOR_SESSION.actorId, kind: OPERATOR_SESSION.actor },

    getPersonalProjection() {
      return api.getPersonalProjection(OPERATOR_SESSION);
    },

    listSubjects() {
      return api.listPlayers().map(asSubject);
    },

    getAccess() {
      const open = api.authorizeOpen(OPERATOR_SESSION);
      const counter = api.getAccessCounter(OPERATOR_SESSION);
      return {
        allowed: open.allowed && counter.remaining > 0,
        remaining: counter.remaining,
      };
    },

    listHistory() {
      return api.listHistory().map(asHistory);
    },

    authorizeSelection(subjectIds) {
      const decision = api.authorizeSelect(OPERATOR_SESSION, subjectIds);
      if (!decision.allowed) {
        return { ok: false, error: mapCoreDenial(decision.reason) };
      }
      return { ok: true, value: true };
    },

    createConsent(subjectIds) {
      const created = api.createConsent(OPERATOR_SESSION, subjectIds);
      if (!created.ok) {
        return { ok: false, error: mapCoreDenial(created.reason) };
      }
      return { ok: true, value: asConsent(created.consent) };
    },

    acceptConsent(consentId, partyId = OPERATOR_SESSION.actorId) {
      const record = api.getConsent(consentId);
      if (!record) {
        return { ok: false, error: "consent_missing" };
      }
      if (!(partyId in record.decisions)) {
        return { ok: false, error: "consent_missing" };
      }

      const result = api.acceptConsent(partySession(partyId), consentId);
      if (!result.ok) {
        return { ok: false, error: mapCoreDenial(result.reason) };
      }

      return { ok: true, value: asConsent(result.consent) };
    },

    refuseConsent(consentId) {
      const result = api.refuseConsent(OPERATOR_SESSION, consentId);
      if (!result.ok) {
        return { ok: false, error: mapCoreDenial(result.reason) };
      }
      return { ok: true, value: asConsent(result.consent) };
    },

    requestRun(request) {
      const pair: [IncubatorSubjectId, IncubatorSubjectId] = [
        request.subjectIds[0],
        request.subjectIds[1],
      ];
      const launched = api.authorizeLaunch(OPERATOR_SESSION, {
        subjectIds: pair,
        consentId: request.consentId,
      });
      if (!launched.allowed) {
        return { ok: false, error: mapCoreDenial(launched.reason) };
      }

      const analysis = api.startAnalysis(OPERATOR_SESSION, {
        subjectIds: pair,
        consentId: request.consentId,
      });
      if (!analysis.ok) {
        return { ok: false, error: mapCoreDenial(analysis.reason) };
      }

      return { ok: true, code: analysis.run.code, entry: asHistory(analysis.run) };
    },
  };
}
