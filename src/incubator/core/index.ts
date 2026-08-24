/**
 * Public Incubator domain API. No Vue, no scene, no secret signatures.
 */

export { createIncubatorCorePlaceholder } from "./createIncubatorCorePlaceholder";
export type { IncubatorAdminApi, IncubatorCoreApi, IncubatorCoreOptions } from "./createIncubatorCore";
export { ARCHIVE_SELECTION_COST, DEFAULT_ACCESS_ALLOWANCE } from "./config";
export { createMockFingerprintHub } from "./mockFingerprintTransport";
export {
  createServerAuthClient,
  createServerFingerprintClient,
  IncubatorTransportError,
} from "./serverFingerprintClient";
export type {
  MockFingerprintHub,
  MockFingerprintHubOptions,
  MockFingerprintScheduler,
} from "./mockFingerprintTransport";
export type { IncubatorBrowserTransportOptions } from "./serverFingerprintClient";

export type {
  CreateIncubatorFingerprintSessionRequest,
  CorrectRunInput,
  IncubatorAccessAction,
  IncubatorAccessCounter,
  IncubatorAccessDecision,
  IncubatorActorKind,
  IncubatorAuthClient,
  IncubatorConsentRecord,
  IncubatorConsentStance,
  IncubatorDenialReason,
  IncubatorFingerprintClient,
  IncubatorFingerprintMutationRequest,
  IncubatorFingerprintSnapshot,
  IncubatorFingerprintSnapshotListener,
  IncubatorPersonalProjection,
  IncubatorPlayerPublic,
  IncubatorPlayerStatus,
  IncubatorPublicConfig,
  IncubatorRevealCode,
  IncubatorRoomSnapshot,
  IncubatorRunRecord,
  IncubatorServerFingerprintClient,
  IncubatorSession,
  IncubatorSubjectId,
  IncubatorTransportErrorCode,
  StartAnalysisInput,
  StartAnalysisResult,
} from "../types";
