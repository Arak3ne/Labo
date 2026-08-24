import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  CreateIncubatorFingerprintSessionRequest,
  IncubatorChamber,
  IncubatorFingerprintClient,
  IncubatorFingerprintResult,
  IncubatorFingerprintSnapshot,
} from "../types";
import { createMockFingerprintHub } from "./mockFingerprintTransport";

function unwrap(result: IncubatorFingerprintResult): IncubatorFingerprintSnapshot {
  if (!result.ok) throw new Error(result.reason);
  return result.snapshot;
}

describe("public realtime fingerprint transport mock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("binds identity at client creation and exposes no subjectId mutation argument", () => {
    expectTypeOf<Parameters<IncubatorFingerprintClient["press"]>>()
      .toEqualTypeOf<[chamber: IncubatorChamber]>();
    expectTypeOf<Parameters<IncubatorFingerprintClient["release"]>>()
      .toEqualTypeOf<[chamber: IncubatorChamber]>();
    expectTypeOf<Parameters<IncubatorFingerprintClient["disconnect"]>>()
      .toEqualTypeOf<[chamber: IncubatorChamber]>();
    expectTypeOf<Parameters<IncubatorFingerprintClient["cancel"]>>()
      .toEqualTypeOf<[]>();
    expectTypeOf<Parameters<IncubatorFingerprintClient["createSession"]>>()
      .toEqualTypeOf<[]>();
    expectTypeOf<CreateIncubatorFingerprintSessionRequest>()
      .toEqualTypeOf<Record<string, never>>();

    const client = createMockFingerprintHub().createClient("A1");
    expect(client.createSession).toHaveLength(0);
    expect(client.press).toHaveLength(1);
    expect(client.release).toHaveLength(1);
    expect(client.disconnect).toHaveLength(1);
    expect(client.cancel).toHaveLength(0);
    expect(client.getAccessCounter).toHaveLength(0);
  });

  it("shares immediate secret-free snapshots between two joined clients", async () => {
    const hub = createMockFingerprintHub();
    const first = hub.createClient("A1");
    const second = hub.createClient("A2");
    const initial = unwrap(await first.createSession());
    const sessionId = initial.id;
    expect(initial.chambers).toEqual({});
    expect(initial).not.toHaveProperty("initiatorChamber");
    await second.joinSession(sessionId);
    const firstSnapshots: IncubatorFingerprintSnapshot[] = [];
    const secondSnapshots: IncubatorFingerprintSnapshot[] = [];

    first.subscribe((snapshot) => firstSnapshots.push(snapshot));
    second.subscribe((snapshot) => secondSnapshots.push(snapshot));

    expect(firstSnapshots).toHaveLength(1);
    expect(secondSnapshots).toHaveLength(1);
    await first.press("left");
    expect(first.getSnapshot()?.initiatorChamber).toBe("left");
    await second.press("right");

    expect(firstSnapshots.at(-1)).toEqual(secondSnapshots.at(-1));
    expect(firstSnapshots.at(-1)).toMatchObject({
      id: sessionId,
      state: "SYNCING",
      chambers: {
        left: { subjectId: "A1", pressed: true },
        right: { subjectId: "A2", pressed: true },
      },
    });
    expect(JSON.stringify(firstSnapshots)).not.toMatch(
      /signature|allele|genotype|adn|dna|computeRevealCode/i,
    );
  });

  it("rejects a contested chamber and a duplicate subject", async () => {
    const hub = createMockFingerprintHub();
    const first = hub.createClient("A1");
    const second = hub.createClient("A2");
    const third = hub.createClient("A3");
    const sessionId = unwrap(await first.createSession()).id;
    await second.joinSession(sessionId);
    await third.joinSession(sessionId);

    expect(await first.press("left")).toMatchObject({ ok: true });
    expect(await second.press("right")).toMatchObject({ ok: true });
    expect(await third.press("right")).toEqual({
      ok: false,
      reason: "chamber_occupied",
    });
    expect(await first.press("right")).toEqual({
      ok: false,
      reason: "subject_already_present",
    });
  });

  it.each(["release", "disconnect"] as const)(
    "applies grace after %s and stops synchronization",
    async (operation) => {
      const hub = createMockFingerprintHub();
      const first = hub.createClient("A1");
      const second = hub.createClient("A2");
      const sessionId = unwrap(await first.createSession()).id;
      await second.joinSession(sessionId);
      await first.press("left");
      await second.press("right");

      await second[operation]("right");
      await vi.advanceTimersByTimeAsync(150);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(first.getSnapshot()).toMatchObject({
        state: "ONE_FINGERPRINT",
        chambers: { right: { subjectId: "A2", pressed: false } },
      });
      expect(hub.getConsumedAccess("A1")).toBe(0);
    },
  );

  it("consumes mock access and emits the public result exactly once", async () => {
    const hub = createMockFingerprintHub({
      initialAccessAllowance: 2,
      revealCodes: ["1"],
      analysisDurationMs: 250,
    });
    const first = hub.createClient("A1");
    const second = hub.createClient("A2");
    const sessionId = unwrap(await first.createSession()).id;
    await second.joinSession(sessionId);

    await first.press("right");
    expect(first.getSnapshot()?.initiatorChamber).toBe("right");
    await first.press("right");
    await second.press("left");
    await second.press("left");
    await vi.advanceTimersByTimeAsync(1_800);

    expect(hub.getConsumedAccess("A1")).toBe(1);
    expect(first.getSnapshot()).toMatchObject({
      state: "ANALYZING",
      result: "1",
      runId: "mock-run-1",
    });
    await vi.runAllTimersAsync();
    expect(first.getSnapshot()?.state).toBe("RESOLVED");
    expect(hub.getConsumedAccess("A1")).toBe(1);
    await expect(first.getAccessCounter()).resolves.toEqual({ used: 1, remaining: 1 });
    await expect(second.getAccessCounter()).resolves.toEqual({ used: 0, remaining: 2 });
  });

  it("keeps syncing when a micro-disconnect straddles the deadline", async () => {
    const hub = createMockFingerprintHub({ analysisDurationMs: 250 });
    const first = hub.createClient("A1");
    const second = hub.createClient("A2");
    const sessionId = unwrap(await first.createSession()).id;
    await second.joinSession(sessionId);
    await first.press("left");
    await second.press("right");

    await vi.advanceTimersByTimeAsync(1_750);
    await second.disconnect("right");
    await vi.advanceTimersByTimeAsync(100);
    await second.press("right");
    await vi.advanceTimersByTimeAsync(100);

    expect(first.getSnapshot()?.state).toBe("ANALYZING");
    expect(hub.getConsumedAccess("A1")).toBe(1);
  });

  it("cleans subscriptions and restricts cancellation to the initiator", async () => {
    const hub = createMockFingerprintHub();
    const first = hub.createClient("A1");
    const second = hub.createClient("A2");
    const sessionId = unwrap(await first.createSession()).id;
    await second.joinSession(sessionId);
    const listener = vi.fn();
    const unsubscribe = second.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(hub.getSubscriberCount(sessionId)).toBe(1);
    unsubscribe();
    expect(hub.getSubscriberCount(sessionId)).toBe(0);
    await first.press("left");
    expect(listener).toHaveBeenCalledTimes(1);

    expect(await second.cancel()).toEqual({ ok: false, reason: "access_denied" });
    expect(unwrap(await first.cancel()).state).toBe("CANCELLED");
  });
});
