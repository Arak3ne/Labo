import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IncubatorFingerprintResult,
  IncubatorSession,
} from "../../types";
import { getAccessCounter } from "../access";
import { createMockPlayers } from "../players.mock";
import { createMemoryStore } from "../store";
import {
  createFingerprintSessionAuthority,
  type FingerprintSessionAuthority,
} from "./fingerprintSession";
import {
  resetBiologicalSignaturesForTests,
  seedBiologicalSignatures,
} from "./signatures";

const initiator: IncubatorSession = { actor: "joueur", actorId: "A1" };
const second: IncubatorSession = { actor: "joueur", actorId: "A2" };
const third: IncubatorSession = { actor: "joueur", actorId: "A3" };

function unwrap(result: IncubatorFingerprintResult): IncubatorFingerprintResult & { ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result;
}

function setup(accessAllowance = 1): {
  authority: FingerprintSessionAuthority;
  store: ReturnType<typeof createMemoryStore>;
} {
  const store = createMemoryStore(accessAllowance);
  seedBiologicalSignatures(createMockPlayers().map((player) => player.id));
  return {
    store,
    authority: createFingerprintSessionAuthority({
      store,
      now: () => new Date(),
      syncDurationMs: 1_800,
      gracePeriodMs: 150,
    }),
  };
}

function create(authority: FingerprintSessionAuthority): string {
  return unwrap(authority.createSession(initiator)).snapshot.id;
}

describe("fingerprint session authority", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T08:00:00.000Z"));
    resetBiologicalSignaturesForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["left", "right"] as const)(
    "creates empty chambers then assigns the initiator to %s on first press",
    (chamber) => {
      const { authority } = setup();
      const created = unwrap(authority.createSession(initiator)).snapshot;

      expect(created).toMatchObject({
        state: "WAITING",
        initiatorId: "A1",
        chambers: {},
      });
      expect(created).not.toHaveProperty("initiatorChamber");

      const pressed = unwrap(authority.press(created.id, initiator, chamber)).snapshot;
      expect(pressed.initiatorChamber).toBe(chamber);
      expect(pressed.chambers[chamber]).toEqual({
        subjectId: "A1",
        pressed: true,
      });
    },
  );

  it("synchronizes two distinct clients then starts exactly one analysis", () => {
    const { authority, store } = setup();
    const sessionId = create(authority);

    expect(unwrap(authority.press(sessionId, initiator, "right")).snapshot.state).toBe(
      "ONE_FINGERPRINT",
    );
    expect(unwrap(authority.press(sessionId, second, "left")).snapshot.state).toBe("SYNCING");

    vi.advanceTimersByTime(1_800);

    const snapshot = authority.getSnapshot(sessionId);
    expect(snapshot).toMatchObject({
      state: "ANALYZING",
      initiatorId: "A1",
      initiatorChamber: "right",
      result: "0",
    });
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.subjectIds).toEqual(["A2", "A1"]);
    const consentId = store.runs[0]?.consentIds[0];
    expect(consentId).toBeDefined();
    expect(store.consents.get(consentId!)).toMatchObject({
      operatorId: "A1",
      subjectIds: ["A2", "A1"],
      decisions: {
        A1: "accepted",
        A2: "accepted",
      },
    });
    expect(getAccessCounter(store, initiator)).toEqual({ used: 1, remaining: 0 });
  });

  it("cancels synchronization after release without run or access consumption", () => {
    const { authority, store } = setup();
    const sessionId = create(authority);
    authority.press(sessionId, initiator, "left");
    authority.press(sessionId, second, "right");

    authority.release(sessionId, second, "right");
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(2_000);

    expect(authority.getSnapshot(sessionId)?.state).toBe("ONE_FINGERPRINT");
    expect(store.runs).toHaveLength(0);
    expect(getAccessCounter(store, initiator)).toEqual({ used: 0, remaining: 1 });
  });

  it("accepts only one deterministic occupant for a contested chamber", () => {
    const { authority } = setup();
    const sessionId = create(authority);

    expect(authority.press(sessionId, initiator, "left").ok).toBe(true);
    expect(authority.press(sessionId, second, "right").ok).toBe(true);
    expect(authority.press(sessionId, third, "right")).toEqual({
      ok: false,
      reason: "chamber_occupied",
    });
    expect(authority.press(sessionId, initiator, "right")).toEqual({
      ok: false,
      reason: "subject_already_present",
    });
    expect(authority.getSnapshot(sessionId)?.chambers.right?.subjectId).toBe("A2");
  });

  it("applies disconnect grace and preserves sync after a timely reconnect", () => {
    const cancelled = setup();
    const cancelledId = create(cancelled.authority);
    cancelled.authority.press(cancelledId, initiator, "left");
    cancelled.authority.press(cancelledId, second, "right");
    cancelled.authority.disconnect(cancelledId, second, "right");

    vi.advanceTimersByTime(149);
    expect(cancelled.authority.getSnapshot(cancelledId)?.state).toBe("SYNCING");
    vi.advanceTimersByTime(1);
    expect(cancelled.authority.getSnapshot(cancelledId)?.state).toBe("ONE_FINGERPRINT");
    vi.advanceTimersByTime(2_000);
    expect(cancelled.store.runs).toHaveLength(0);

    const recovered = setup();
    const recoveredId = create(recovered.authority);
    recovered.authority.press(recoveredId, initiator, "left");
    recovered.authority.press(recoveredId, second, "right");
    recovered.authority.disconnect(recoveredId, second, "right");
    vi.advanceTimersByTime(100);
    recovered.authority.press(recoveredId, second, "right");
    vi.advanceTimersByTime(1_700);

    expect(recovered.authority.getSnapshot(recoveredId)?.state).toBe("ANALYZING");
    expect(recovered.store.runs).toHaveLength(1);
  });

  it("preserves synchronization when grace overlaps its deadline", () => {
    const { authority, store } = setup();
    const sessionId = create(authority);
    authority.press(sessionId, initiator, "left");
    authority.press(sessionId, second, "right");

    vi.advanceTimersByTime(1_750);
    authority.disconnect(sessionId, second, "right");
    vi.advanceTimersByTime(100);
    authority.press(sessionId, second, "right");
    vi.advanceTimersByTime(100);

    expect(authority.getSnapshot(sessionId)?.state).toBe("ANALYZING");
    expect(store.runs).toHaveLength(1);
  });

  it("is idempotent under duplicate presses, releases, and timer callbacks", () => {
    const { authority, store } = setup(2);
    const sessionId = create(authority);
    authority.press(sessionId, initiator, "left");
    authority.press(sessionId, initiator, "left");
    authority.press(sessionId, second, "right");
    authority.press(sessionId, second, "right");

    vi.advanceTimersByTime(1_800);
    vi.runAllTimers();

    expect(store.runs).toHaveLength(1);
    expect(getAccessCounter(store, initiator)).toEqual({ used: 1, remaining: 1 });
    expect(authority.press(sessionId, second, "right")).toEqual({
      ok: false,
      reason: "session_closed",
    });
    expect(authority.release(sessionId, second, "right").ok).toBe(true);
    expect(authority.disconnect(sessionId, initiator, "left").ok).toBe(true);
    expect(authority.getSnapshot(sessionId)?.state).toBe("ANALYZING");
    expect(authority.resolve(sessionId).ok).toBe(true);
    expect(authority.resolve(sessionId).ok).toBe(true);
    expect(store.runs).toHaveLength(1);
  });

  it("refuses creation when the initiator has no access", () => {
    const { authority, store } = setup(0);

    expect(authority.createSession(initiator)).toEqual({
      ok: false,
      reason: "access_exhausted",
    });
    expect(store.runs).toHaveLength(0);
  });

  it("publishes immutable secret-free transport snapshots", () => {
    const { authority } = setup();
    const sessionId = create(authority);
    const received: unknown[] = [];
    authority.subscribe(sessionId, (snapshot) => received.push(snapshot));
    authority.press(sessionId, initiator, "left");
    authority.press(sessionId, second, "right");
    vi.advanceTimersByTime(1_800);

    const snapshot = authority.getSnapshot(sessionId);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot?.chambers)).toBe(true);
    expect(Object.isFrozen(snapshot?.chambers.left)).toBe(true);
    expect(JSON.stringify([...received, snapshot])).not.toMatch(
      /signature|allele|genotype|adn|dna|admin|game.?master|[αβγδ]/i,
    );
    expect(Object.keys(snapshot ?? {}).sort()).toEqual(
      [
        "chambers",
        "createdAt",
        "id",
        "initiatorChamber",
        "initiatorId",
        "result",
        "runId",
        "state",
        "updatedAt",
      ].sort(),
    );
  });
});
