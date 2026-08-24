import type {
  IncubatorActorKind,
  IncubatorConsentStance,
  IncubatorPersonalProjection,
  IncubatorRevealCode,
  IncubatorSubjectId,
} from "../types";

export type IncubatorSubjectStatus = "actif" | "archivé";

export type IncubatorUiPhase =
  | "boot"
  | "identification"
  | "intro_transition"
  | "inside"
  | "access_terminal"
  | "access_granted"
  | "waiting_participant"
  | "waiting"
  | "one_fingerprint"
  | "syncing"
  | "analyze"
  | "reveal"
  | "cancelled";

export type IncubatorUiErrorKind =
  | "access_denied"
  | "consent_missing"
  | "consent_refused"
  | "invalid_selection";

export type IncubatorCoreSource = "core" | "mock";

export interface IncubatorActorPreview {
  id: string;
  kind: IncubatorActorKind;
}

export interface IncubatorSubjectCard {
  id: IncubatorSubjectId;
  label: string;
  status: IncubatorSubjectStatus;
}

export interface IncubatorAccessSnapshot {
  allowed: boolean;
  remaining: number;
}

export interface IncubatorHistoryEntry {
  id: string;
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId];
  code: IncubatorRevealCode;
  at: string;
  actor: IncubatorActorPreview;
  consentId: string;
}

export interface IncubatorConsentPreview {
  id: string;
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId];
  granted: boolean;
  decisions: Record<string, IncubatorConsentStance>;
}

export interface IncubatorRunRequest {
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId];
  consentId: string;
}

export type IncubatorCoreDecision =
  | { ok: true; code: IncubatorRevealCode; entry: IncubatorHistoryEntry }
  | { ok: false; error: IncubatorUiErrorKind };

export type IncubatorClientResult<T> = { ok: true; value: T } | { ok: false; error: IncubatorUiErrorKind };

export interface IncubatorCoreClient {
  source: IncubatorCoreSource;
  archiveCost: number;
  operator: IncubatorActorPreview;
  getPersonalProjection(): IncubatorPersonalProjection | undefined;
  listSubjects(): IncubatorSubjectCard[];
  getAccess(): IncubatorAccessSnapshot;
  listHistory(): IncubatorHistoryEntry[];
  authorizeSelection(subjectIds: readonly IncubatorSubjectId[]): IncubatorClientResult<true>;
  createConsent(
    subjectIds: [IncubatorSubjectId, IncubatorSubjectId],
  ): IncubatorClientResult<IncubatorConsentPreview>;
  acceptConsent(
    consentId: string,
    partyId?: string,
  ): IncubatorClientResult<IncubatorConsentPreview>;
  refuseConsent(consentId: string): IncubatorClientResult<IncubatorConsentPreview>;
  requestRun(request: IncubatorRunRequest): IncubatorCoreDecision;
}
