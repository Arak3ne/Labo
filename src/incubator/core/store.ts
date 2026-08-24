import type {
  IncubatorAccessCounter,
  IncubatorConsentRecord,
  IncubatorPlayerPublic,
  IncubatorRunRecord,
} from "../types";
import { DEFAULT_ACCESS_ALLOWANCE } from "./config";
import { createMockPlayers } from "./players.mock";

export interface IncubatorMemoryStore {
  players: Map<string, IncubatorPlayerPublic>;
  access: Map<string, IncubatorAccessCounter>;
  consents: Map<string, IncubatorConsentRecord>;
  runs: IncubatorRunRecord[];
  nextId: (prefix: string) => string;
}

export function createMemoryStore(
  accessAllowance = DEFAULT_ACCESS_ALLOWANCE,
): IncubatorMemoryStore {
  const players = new Map<string, IncubatorPlayerPublic>();
  const access = new Map<string, IncubatorAccessCounter>();

  for (const player of createMockPlayers()) {
    players.set(player.id, { ...player });
    access.set(player.id, { used: 0, remaining: accessAllowance });
  }

  let seq = 0;
  return {
    players,
    access,
    consents: new Map(),
    runs: [],
    nextId: (prefix: string) => `${prefix}-${++seq}`,
  };
}

export function clonePlayer(player: IncubatorPlayerPublic): IncubatorPlayerPublic {
  return { id: player.id, displayName: player.displayName, status: player.status };
}

export function cloneConsent(record: IncubatorConsentRecord): IncubatorConsentRecord {
  return {
    id: record.id,
    operatorId: record.operatorId,
    subjectIds: [record.subjectIds[0], record.subjectIds[1]],
    decisions: { ...record.decisions },
    createdAt: record.createdAt,
  };
}

export function cloneRun(run: IncubatorRunRecord): IncubatorRunRecord {
  return {
    id: run.id,
    subjectIds: [run.subjectIds[0], run.subjectIds[1]],
    code: run.code,
    timestamp: run.timestamp,
    actor: run.actor,
    actorId: run.actorId,
    consentIds: [...run.consentIds],
  };
}
