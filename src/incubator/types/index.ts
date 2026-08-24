/**
 * Shared incubator contracts.
 * Domain rules belong in `incubator/core` (server-backed).
 * Secret DNA must never be stored or computed on the client.
 */

export type IncubatorModuleId = "core" | "ui" | "scene" | "audio";

export type IncubatorRevealCode = "0" | "1" | "M";

export type IncubatorSubjectId = string;

export interface IncubatorSubjectPreview {
  id: IncubatorSubjectId;
  displayName?: string;
  status?: IncubatorPlayerStatus;
}

export type IncubatorPlayerStatus = "actif" | "archivé";

export type IncubatorActorKind = "joueur" | "admin";

export interface IncubatorSession {
  actorId: string;
  actor: IncubatorActorKind;
}

export interface IncubatorPlayerPublic {
  id: string;
  displayName: string;
  status: IncubatorPlayerStatus;
}

export interface IncubatorAccessCounter {
  used: number;
  remaining: number;
}

export interface IncubatorPersonalProjection {
  player: IncubatorPlayerPublic;
  access: {
    allowed: boolean;
    used: number;
    remaining: number;
  };
}

export type IncubatorAccessAction = "open" | "select" | "launch";

export type IncubatorDenialReason =
  | "not_authenticated"
  | "access_denied"
  | "access_exhausted"
  | "invalid_subject_count"
  | "duplicate_subjects"
  | "unknown_subject"
  | "consent_required"
  | "consent_refused"
  | "consent_incomplete"
  | "consent_mismatch"
  | "admin_required"
  | "unknown_run";

export interface IncubatorAccessDecision {
  allowed: boolean;
  reason?: IncubatorDenialReason;
}

export type IncubatorConsentStance = "accepted" | "refused" | "pending";

export interface IncubatorConsentRecord {
  id: string;
  operatorId: string;
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId];
  decisions: Record<string, IncubatorConsentStance>;
  createdAt: string;
}

export interface IncubatorRunRecord {
  id: string;
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId];
  code: IncubatorRevealCode;
  timestamp: string;
  actor: IncubatorActorKind;
  actorId: string;
  consentIds: string[];
}

export interface IncubatorPublicConfig {
  archiveSelectionCost: number;
}

export interface StartAnalysisInput {
  subjectIds: [IncubatorSubjectId, IncubatorSubjectId];
  consentId?: string;
  ignoreConsent?: boolean;
}

export type StartAnalysisResult =
  | { ok: true; run: IncubatorRunRecord }
  | { ok: false; reason: IncubatorDenialReason };

export interface CorrectRunInput {
  code?: IncubatorRevealCode;
  subjectIds?: [IncubatorSubjectId, IncubatorSubjectId];
  consentIds?: string[];
}

export type IncubatorFingerprintState =
  | "WAITING"
  | "ONE_FINGERPRINT"
  | "SYNCING"
  | "ANALYZING"
  | "RESOLVED"
  | "CANCELLED";

export type IncubatorChamber = "left" | "right";

export type IncubatorFingerprintDenialReason =
  | "not_authenticated"
  | "access_exhausted"
  | "unknown_session"
  | "session_closed"
  | "chamber_occupied"
  | "subject_already_present"
  | "access_denied"
  | "invalid_state";

export interface IncubatorFingerprintOccupant {
  subjectId: IncubatorSubjectId;
  pressed: boolean;
}

export interface IncubatorFingerprintSnapshot {
  id: string;
  state: IncubatorFingerprintState;
  initiatorId: string;
  initiatorChamber?: IncubatorChamber;
  chambers: Readonly<{
    left?: Readonly<IncubatorFingerprintOccupant>;
    right?: Readonly<IncubatorFingerprintOccupant>;
  }>;
  runId?: string;
  result?: IncubatorRevealCode;
  createdAt: string;
  updatedAt: string;
}

export interface IncubatorRoomSnapshot extends IncubatorFingerprintSnapshot {
  accessCode: string;
  participants: readonly IncubatorPlayerPublic[];
  expiresAt: string;
}

export type IncubatorFingerprintResult<T extends IncubatorFingerprintSnapshot = IncubatorFingerprintSnapshot> =
  | { ok: true; snapshot: T }
  | { ok: false; reason: IncubatorFingerprintDenialReason };

export type IncubatorFingerprintSnapshotListener<T extends IncubatorFingerprintSnapshot = IncubatorFingerprintSnapshot> = (
  snapshot: T,
) => void;

/**
 * Client-side realtime transport contract.
 *
 * A concrete client is bound to the authenticated player when it is created.
 * Consequently, mutating methods deliberately accept only a chamber: the
 * production adapter must derive player identity from its authenticated
 * cookie/session and must never send a caller-supplied subject id.
 *
 * Intended production mapping:
 * - `createSession`: `POST /api/incubations` with `{ accessCode }`
 * - `joinSession`: `POST /api/incubations/join` with an access code
 * - `press`: `POST .../chambers/:chamber/fingerprint` with an empty body
 * - `release` / `disconnect`: `DELETE .../chambers/:chamber/fingerprint`
 * - `subscribe`: authenticated `/ws?incubationId=...`
 * - `cancel`: `DELETE /api/incubations/:incubationId`
 *
 * HTTP bodies contain session/chamber data only. Authentication is carried by
 * the cookie/session; no endpoint accepts a `subjectId`. Snapshots are the
 * complete public payload and never contain biological signatures.
 */
export interface IncubatorFingerprintClient {
  createSession(accessCode: string): Promise<IncubatorFingerprintResult>;
  joinSession(accessCode: string): Promise<IncubatorFingerprintResult>;
  getSnapshot(): IncubatorFingerprintSnapshot | undefined;
  /** Server-owned counter for the authenticated client; never mutated locally. */
  getAccessCounter(): Promise<IncubatorAccessCounter>;
  subscribe(listener: IncubatorFingerprintSnapshotListener): () => void;
  press(chamber: IncubatorChamber): Promise<IncubatorFingerprintResult>;
  release(chamber: IncubatorChamber): Promise<IncubatorFingerprintResult>;
  disconnect(chamber: IncubatorChamber): Promise<IncubatorFingerprintResult>;
  cancel(): Promise<IncubatorFingerprintResult>;
  /** Releases browser transport resources when the owning scope is disposed. */
  destroy?(): void;
}

export type IncubatorTransportErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "request_failed"
  | "invalid_response"
  | "network_error";

export type IncubatorFingerprintTransportEvent =
  | {
      type: "session_unavailable";
      reason: "unknown_session" | "session_closed";
    }
  | {
      type: "connection_interrupted";
      reason: "network_error";
    };

export interface IncubatorAuthClient {
  login(playerCode: string): Promise<IncubatorPersonalProjection>;
  logout(): Promise<void>;
  getMe(): Promise<IncubatorPersonalProjection>;
}

export interface IncubatorServerFingerprintClient extends IncubatorFingerprintClient {
  createSession(accessCode: string): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  joinSession(accessCode: string): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  getSnapshot(): IncubatorRoomSnapshot | undefined;
  refreshSnapshot(): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  subscribe(listener: IncubatorFingerprintSnapshotListener<IncubatorRoomSnapshot>): () => void;
  subscribeTransport(
    listener: (event: IncubatorFingerprintTransportEvent) => void,
  ): () => void;
  press(chamber: IncubatorChamber): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  release(chamber: IncubatorChamber): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  disconnect(chamber: IncubatorChamber): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  cancel(): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>>;
  destroy(): void;
}

/** The canonical access code becomes the shared room code. */
export interface CreateIncubatorFingerprintSessionRequest {
  accessCode: string;
}

/**
 * Production fingerprint POST/DELETE bodies are empty. The chamber is encoded
 * in the URL and identity is derived from the authenticated cookie.
 */
export type IncubatorFingerprintMutationRequest = Record<string, never>;

export interface IncubatorSceneApi {
  introBoot(): void;
  introIdentify(): void;
  introEnter(): void;
  idle(): void;
  focusLeft(): void;
  focusRight(): void;
  fingerprintFocus(chamber: IncubatorChamber): void;
  fingerprintPress(chamber: IncubatorChamber): void;
  fingerprintRelease(chamber: IncubatorChamber): void;
  fingerprintSync(): void;
  fingerprintConfirmed(): void;
  loadSubjects(): void;
  startAnalysis(): void;
  revealResult(code: IncubatorRevealCode): void;
  reset(): void;
}

export type IncubatorRuntimeFlag = "scene" | "gsap" | "audio" | "rive";
