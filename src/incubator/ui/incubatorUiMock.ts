import type { IncubatorRevealCode, IncubatorSubjectId } from "../types";
import type {
  IncubatorAccessSnapshot,
  IncubatorActorPreview,
  IncubatorConsentPreview,
  IncubatorCoreClient,
  IncubatorCoreDecision,
  IncubatorHistoryEntry,
  IncubatorRunRequest,
  IncubatorSubjectCard,
} from "./incubatorUiTypes";

/** MOCK — affichage uniquement si `core` n’exporte pas le coût. */
export const MOCK_ARCHIVE_COST = 1;

const MOCK_OPERATOR: IncubatorActorPreview = {
  id: "A1",
  kind: "joueur",
};

const MOCK_SUBJECTS: IncubatorSubjectCard[] = [
  { id: "A1", label: "Sujet A1", status: "actif" },
  { id: "A2", label: "Sujet A2", status: "actif" },
  { id: "A3", label: "Sujet A3", status: "actif" },
  { id: "D2", label: "Sujet D2", status: "archivé" },
  { id: "D3", label: "Sujet D3", status: "archivé" },
];

const MOCK_REVEAL_QUEUE: IncubatorRevealCode[] = ["M", "0", "1"];

function isPair(
  ids: IncubatorSubjectId[],
): ids is [IncubatorSubjectId, IncubatorSubjectId] {
  return ids.length === 2 && ids[0] !== ids[1];
}

export function createMockIncubatorCoreClient(): IncubatorCoreClient {
  let remaining = 3;
  let revealCursor = 0;
  let runSerial = 0;
  let consentSerial = 0;
  const history: IncubatorHistoryEntry[] = [];
  const consents = new Map<string, IncubatorConsentPreview>();

  return {
    source: "mock",
    archiveCost: MOCK_ARCHIVE_COST,
    operator: MOCK_OPERATOR,

    getPersonalProjection() {
      const player = MOCK_SUBJECTS.find((subject) => subject.id === MOCK_OPERATOR.id)!;
      return {
        player: {
          id: player.id,
          displayName: player.label,
          status: player.status,
        },
        access: {
          allowed: remaining > 0,
          used: 3 - remaining,
          remaining,
        },
      };
    },

    listSubjects() {
      return MOCK_SUBJECTS.map((subject) => ({ ...subject }));
    },

    getAccess(): IncubatorAccessSnapshot {
      return {
        allowed: remaining > 0,
        remaining,
      };
    },

    listHistory() {
      return history.map((entry) => ({
        ...entry,
        subjectIds: [...entry.subjectIds],
        actor: { ...entry.actor },
      }));
    },

    authorizeSelection(subjectIds) {
      if (subjectIds.length > 2) {
        return { ok: false, error: "invalid_selection" };
      }
      if (subjectIds.length === 2 && subjectIds[0] === subjectIds[1]) {
        return { ok: false, error: "invalid_selection" };
      }
      return { ok: true, value: true };
    },

    createConsent(subjectIds) {
      if (!isPair(subjectIds)) {
        return { ok: false, error: "invalid_selection" };
      }
      consentSerial += 1;
      const decisions = {
        [MOCK_OPERATOR.id]: "pending" as const,
        [subjectIds[0]]: "pending" as const,
        [subjectIds[1]]: "pending" as const,
      };
      const record: IncubatorConsentPreview = {
        id: `consent-${consentSerial}`,
        subjectIds: [...subjectIds],
        granted: false,
        decisions,
      };
      consents.set(record.id, record);
      return { ok: true, value: { ...record, decisions: { ...decisions } } };
    },

    acceptConsent(consentId, partyId = MOCK_OPERATOR.id) {
      const record = consents.get(consentId);
      if (!record) {
        return { ok: false, error: "consent_missing" };
      }
      if (!(partyId in record.decisions)) {
        return { ok: false, error: "consent_missing" };
      }
      const decisions = { ...record.decisions, [partyId]: "accepted" as const };
      const granted = Object.values(decisions).every((stance) => stance === "accepted");
      const next = { ...record, decisions, granted };
      consents.set(consentId, next);
      return { ok: true, value: { ...next, decisions: { ...decisions } } };
    },

    refuseConsent(consentId) {
      const record = consents.get(consentId);
      if (!record) {
        return { ok: false, error: "consent_missing" };
      }
      const decisions = { ...record.decisions, [MOCK_OPERATOR.id]: "refused" as const };
      const next = { ...record, decisions, granted: false };
      consents.set(consentId, next);
      return { ok: true, value: { ...next, decisions: { ...decisions } } };
    },

    requestRun(request: IncubatorRunRequest): IncubatorCoreDecision {
      if (remaining <= 0) {
        return { ok: false, error: "access_denied" };
      }
      if (!isPair(request.subjectIds)) {
        return { ok: false, error: "invalid_selection" };
      }
      const consent = consents.get(request.consentId);
      if (!consent || !consent.granted) {
        return { ok: false, error: "consent_missing" };
      }

      const code = MOCK_REVEAL_QUEUE[revealCursor % MOCK_REVEAL_QUEUE.length];
      revealCursor += 1;
      remaining -= 1;
      runSerial += 1;

      const entry: IncubatorHistoryEntry = {
        id: `run-${runSerial}`,
        subjectIds: [...request.subjectIds],
        code,
        at: new Date().toISOString(),
        actor: { ...MOCK_OPERATOR },
        consentId: consent.id,
      };
      history.unshift(entry);
      return { ok: true, code, entry };
    },
  };
}
