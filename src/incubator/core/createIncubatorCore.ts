import type {
  CorrectRunInput,
  IncubatorAccessDecision,
  IncubatorConsentRecord,
  IncubatorConsentStance,
  IncubatorDenialReason,
  IncubatorPersonalProjection,
  IncubatorPlayerPublic,
  IncubatorPublicConfig,
  IncubatorRunRecord,
  IncubatorSession,
  IncubatorSubjectId,
  StartAnalysisInput,
  StartAnalysisResult,
} from "../types";
import {
  authorizeLaunchAccess,
  authorizeOpen,
  authorizeSelect,
  consumeAccess,
  getAccessCounter,
  isAdminSession,
  normalizeSubjectPair,
  resolveSession,
} from "./access";
import {
  authorizeConsentForLaunch,
  canActOnConsent,
  createConsentRecord,
  setConsentStance,
} from "./consent";
import { ARCHIVE_SELECTION_COST, createPublicConfig, DEFAULT_ACCESS_ALLOWANCE } from "./config";
import { computeRevealCode } from "./server/compare";
import { adminCorrectRun, adminForceConsent, requireAdmin } from "./server/admin";
import { seedBiologicalSignatures } from "./server/signatures";
import {
  cloneConsent,
  clonePlayer,
  cloneRun,
  createMemoryStore,
  type IncubatorMemoryStore,
} from "./store";

export interface IncubatorCoreOptions {
  accessAllowance?: number;
  archiveSelectionCost?: number;
  now?: () => Date;
}

export interface IncubatorAdminApi {
  forceConsent(
    session: IncubatorSession,
    consentId: string,
  ): { ok: true; consent: IncubatorConsentRecord } | { ok: false; reason: IncubatorDenialReason };
  startAnalysis(session: IncubatorSession, input: StartAnalysisInput): StartAnalysisResult;
  correctRun(
    session: IncubatorSession,
    runId: string,
    patch: CorrectRunInput,
  ): { ok: true; run: IncubatorRunRecord } | { ok: false; reason: IncubatorDenialReason };
}

export interface IncubatorCoreApi {
  readonly config: IncubatorPublicConfig;
  readonly archiveSelectionCost: number;
  readonly admin: IncubatorAdminApi;
  listPlayers(): IncubatorPlayerPublic[];
  getPlayer(id: string): IncubatorPlayerPublic | undefined;
  getPersonalProjection(session: IncubatorSession): IncubatorPersonalProjection | undefined;
  getAccessCounter(session: IncubatorSession): ReturnType<typeof getAccessCounter>;
  authorizeOpen(session: IncubatorSession): IncubatorAccessDecision;
  authorizeSelect(session: IncubatorSession, subjectIds: readonly IncubatorSubjectId[]): IncubatorAccessDecision;
  authorizeLaunch(session: IncubatorSession, input: StartAnalysisInput): IncubatorAccessDecision;
  createConsent(
    session: IncubatorSession,
    subjectIds: [IncubatorSubjectId, IncubatorSubjectId],
  ): { ok: true; consent: IncubatorConsentRecord } | { ok: false; reason: NonNullable<IncubatorAccessDecision["reason"]> };
  getConsent(consentId: string): IncubatorConsentRecord | undefined;
  acceptConsent(
    session: IncubatorSession,
    consentId: string,
  ): { ok: true; consent: IncubatorConsentRecord } | { ok: false; reason: IncubatorDenialReason };
  refuseConsent(
    session: IncubatorSession,
    consentId: string,
  ): { ok: true; consent: IncubatorConsentRecord } | { ok: false; reason: IncubatorDenialReason };
  startAnalysis(session: IncubatorSession, input: StartAnalysisInput): StartAnalysisResult;
  listHistory(): IncubatorRunRecord[];
  getRun(runId: string): IncubatorRunRecord | undefined;
}

function failStance(
  store: IncubatorMemoryStore,
  session: IncubatorSession,
  consentId: string,
  stance: Exclude<IncubatorConsentStance, "pending">,
): ReturnType<IncubatorCoreApi["acceptConsent"]> {
  const auth = resolveSession(store, session);
  if (auth) {
    return { ok: false, reason: auth };
  }
  if (!canActOnConsent(store, session, consentId)) {
    return { ok: false, reason: store.consents.has(consentId) ? "access_denied" : "consent_required" };
  }
  const partyId = isAdminSession(session)
    ? undefined
    : session.actorId;
  if (!partyId) {
    return { ok: false, reason: "access_denied" };
  }
  const consent = setConsentStance(store, consentId, partyId, stance);
  if (!consent) {
    return { ok: false, reason: "consent_required" };
  }
  return { ok: true, consent };
}

export function createIncubatorCore(options: IncubatorCoreOptions = {}): IncubatorCoreApi {
  const accessAllowance = options.accessAllowance ?? DEFAULT_ACCESS_ALLOWANCE;
  const archiveSelectionCost = options.archiveSelectionCost ?? ARCHIVE_SELECTION_COST;
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const store = createMemoryStore(accessAllowance);
  seedBiologicalSignatures([...store.players.keys()]);

  const config = createPublicConfig(archiveSelectionCost);

  function authorizeLaunch(session: IncubatorSession, input: StartAnalysisInput): IncubatorAccessDecision {
    const access = authorizeLaunchAccess(store, session, input.subjectIds);
    if (!access.allowed) {
      return access;
    }
    const pair = normalizeSubjectPair(store, input.subjectIds);
    if (!pair.allowed || !pair.pair) {
      return { allowed: false, reason: pair.reason };
    }
    const consent = authorizeConsentForLaunch(
      store,
      session,
      pair.pair,
      input.consentId,
      Boolean(input.ignoreConsent),
    );
    if (consent.reason) {
      return { allowed: false, reason: consent.reason };
    }
    return { allowed: true };
  }

  function startAnalysis(session: IncubatorSession, input: StartAnalysisInput): StartAnalysisResult {
    const decision = authorizeLaunch(session, input);
    if (!decision.allowed) {
      return { ok: false, reason: decision.reason ?? "access_denied" };
    }

    const pair = normalizeSubjectPair(store, input.subjectIds);
    if (!pair.pair) {
      return { ok: false, reason: pair.reason ?? "invalid_subject_count" };
    }

    const consent = authorizeConsentForLaunch(
      store,
      session,
      pair.pair,
      input.consentId,
      Boolean(input.ignoreConsent),
    );

    const code = computeRevealCode(pair.pair[0], pair.pair[1]);
    const run: IncubatorRunRecord = {
      id: store.nextId("run"),
      subjectIds: pair.pair,
      code,
      timestamp: now(),
      actor: session.actor,
      actorId: session.actorId,
      consentIds: consent.consentIds,
    };
    store.runs.push(run);

    if (!isAdminSession(session)) {
      consumeAccess(store, session.actorId);
    }

    return { ok: true, run: cloneRun(run) };
  }

  const admin: IncubatorAdminApi = {
    forceConsent(session, consentId) {
      const result = adminForceConsent(store, session, consentId);
      if (!result.record) {
        return { ok: false, reason: result.reason ?? "consent_required" };
      }
      return { ok: true, consent: result.record };
    },
    startAnalysis(session, input) {
      const denied = requireAdmin(session);
      if (denied) {
        return { ok: false, reason: denied };
      }
      return startAnalysis(session, input);
    },
    correctRun(session, runId, patch) {
      const result = adminCorrectRun(store, session, runId, patch);
      if (!result.run) {
        return { ok: false, reason: result.reason ?? "unknown_run" };
      }
      return { ok: true, run: result.run };
    },
  };

  return {
    config,
    archiveSelectionCost,
    admin,
    listPlayers() {
      return [...store.players.values()].map(clonePlayer);
    },
    getPlayer(id) {
      const player = store.players.get(id);
      return player ? clonePlayer(player) : undefined;
    },
    getPersonalProjection(session) {
      if (resolveSession(store, session) || isAdminSession(session)) {
        return undefined;
      }
      const player = store.players.get(session.actorId);
      if (!player) {
        return undefined;
      }
      const counter = getAccessCounter(store, session);
      return {
        player: clonePlayer(player),
        access: {
          allowed: authorizeOpen(store, session).allowed && counter.remaining > 0,
          used: counter.used,
          remaining: counter.remaining,
        },
      };
    },
    getAccessCounter(session) {
      return getAccessCounter(store, session);
    },
    authorizeOpen(session) {
      return authorizeOpen(store, session);
    },
    authorizeSelect(session, subjectIds) {
      return authorizeSelect(store, session, subjectIds);
    },
    authorizeLaunch,
    createConsent(session, subjectIds) {
      const opened = authorizeOpen(store, session);
      if (!opened.allowed) {
        return { ok: false, reason: opened.reason ?? "access_denied" };
      }
      const pair = normalizeSubjectPair(store, subjectIds);
      if (!pair.allowed || !pair.pair) {
        return { ok: false, reason: pair.reason ?? "invalid_subject_count" };
      }
      return { ok: true, consent: createConsentRecord(store, session, pair.pair, now()) };
    },
    getConsent(consentId) {
      const record = store.consents.get(consentId);
      return record ? cloneConsent(record) : undefined;
    },
    acceptConsent(session, consentId) {
      return failStance(store, session, consentId, "accepted");
    },
    refuseConsent(session, consentId) {
      return failStance(store, session, consentId, "refused");
    },
    startAnalysis,
    listHistory() {
      return store.runs.map(cloneRun);
    },
    getRun(runId) {
      const run = store.runs.find((entry) => entry.id === runId);
      return run ? cloneRun(run) : undefined;
    },
  };
}
