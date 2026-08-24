import { effectScope, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MorueVoiceApi } from "../audio";
import { IncubatorTransportError } from "../core/serverFingerprintClient";
import type {
  IncubatorPersonalProjection,
  IncubatorRoomSnapshot,
  IncubatorSceneApi,
  IncubatorServerFingerprintClient,
  IncubatorFingerprintTransportEvent,
} from "../types";
import { createMockRoomFingerprintClient } from "./incubatorFingerprintMock";
import { mapPublicDenialToVoice, useIncubatorConsole } from "./useIncubatorConsole";

const projection: IncubatorPersonalProjection = {
  player: { id: "A1", displayName: "SUJET A1", status: "actif" },
  access: { allowed: true, used: 0, remaining: 1 },
};
const participant2 = { id: "A2", displayName: "SUJET A2", status: "actif" as const };

function room(participants = [projection.player]): IncubatorRoomSnapshot {
  return {
    id: "room-internal",
    accessCode: "Z9-Z9",
    initiatorId: projection.player.id,
    participants,
    state: "WAITING",
    chambers: {},
    createdAt: "2026-08-24T08:00:00.000Z",
    updatedAt: "2026-08-24T08:00:00.000Z",
    expiresAt: "2026-08-24T08:15:00.000Z",
  };
}

function makeClient(initial = room()) {
  let current = initial;
  let listener: ((snapshot: IncubatorRoomSnapshot) => void) | undefined;
  let transportListener: ((event: IncubatorFingerprintTransportEvent) => void) | undefined;
  const success = () => Promise.resolve({ ok: true as const, snapshot: current });
  const client: IncubatorServerFingerprintClient & {
    push(snapshot: IncubatorRoomSnapshot): void;
    pushTransport(event: IncubatorFingerprintTransportEvent): void;
  } = {
    createSession: vi.fn(success),
    joinSession: vi.fn(success),
    getSnapshot: () => current,
    refreshSnapshot: vi.fn(success),
    getAccessCounter: vi.fn(async () => ({ used: 0, remaining: 1 })),
    subscribe: vi.fn((next) => {
      listener = next;
      return () => { listener = undefined; };
    }),
    subscribeTransport: vi.fn((next) => {
      transportListener = next;
      return () => { transportListener = undefined; };
    }),
    press: vi.fn(success),
    release: vi.fn(success),
    disconnect: vi.fn(success),
    cancel: vi.fn(success),
    destroy: vi.fn(),
    push(snapshot) {
      current = snapshot;
      listener?.(snapshot);
    },
    pushTransport(event) {
      transportListener?.(event);
    },
  };
  return client;
}

function makeScene() {
  const method = () => vi.fn();
  return {
    morueInit: vi.fn((options?: { reducedMotion?: boolean; onAct?: (act: "wake" | "identify" | "overview" | "threshold") => void }) => {
      options?.onAct?.("wake");
    }),
    finishMorueInit: method(),
    resumeMorueInit: method(),
    enterLab: vi.fn((options?: { reducedMotion?: boolean; onComplete?: () => void }) => {
      options?.onComplete?.();
    }),
    introBoot: method(),
    introIdentify: method(),
    introEnter: method(),
    idle: method(),
    focusLeft: method(),
    focusRight: method(),
    fingerprintFocus: method(),
    fingerprintPress: method(),
    fingerprintRelease: method(),
    fingerprintSync: method(),
    fingerprintConfirmed: method(),
    loadSubjects: method(),
    startAnalysis: method(),
    revealResult: method(),
    reset: method(),
    accessTerminalFocus: method(),
    accessGranted: method(),
  };
}

function makeVoice(speakResult = true): MorueVoiceApi {
  return {
    speak: vi.fn(() => speakResult),
    stop: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: vi.fn(() => false),
    preload: vi.fn(async () => undefined),
    getState: vi.fn(() => ({ status: "idle" })),
    destroy: vi.fn(),
  };
}

function harness(client = makeClient(), voice = makeVoice(), skipIntro = true) {
  const scene = makeScene();
  const scope = effectScope();
  const state = scope.run(() => useIncubatorConsole(
    ref({ api: scene as IncubatorSceneApi }),
    {
      projection,
      fingerprintClient: client,
      voice,
      accessCodeDebounceMs: 20,
      accessGrantedDelayMs: 10,
      analyzeHoldMs: 10,
    },
  ))!;
  if (skipIntro) {
    state.skipIntro();
    state.openAccessTerminal();
  }
  return { client, scene, scope, state, voice };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("server-backed Incubator console", () => {
  it("starts one MORUE scene command and keeps explicit terminal entry", async () => {
    const test = harness(makeClient(), makeVoice(), false);

    expect(test.scene.morueInit).toHaveBeenCalledTimes(1);
    expect(test.scene.morueInit).toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: false }));
    expect(test.voice.stop).not.toHaveBeenCalled();
    expect(test.scene.introBoot).not.toHaveBeenCalled();
    expect(test.scene.introIdentify).not.toHaveBeenCalled();
    expect(test.scene.introEnter).not.toHaveBeenCalled();
    expect(test.voice.speak).toHaveBeenCalledWith(
      "morue_init",
      expect.objectContaining({ dedupeKey: "intro-cinematic", once: true }),
    );

    vi.mocked(test.voice.speak).mock.calls[0]?.[1]?.onEnded?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(test.scene.resumeMorueInit).toHaveBeenCalled();

    vi.mocked(test.scene.morueInit).mock.calls[0]?.[0]?.onAct?.("identify");
    expect(test.state.phase.value).toBe("identification");
    expect(test.voice.speak).toHaveBeenCalledWith(
      "signature_classified",
      expect.objectContaining({ dedupeKey: "intro", once: true }),
    );
    vi.mocked(test.scene.morueInit).mock.calls[0]?.[0]?.onAct?.("overview");
    expect(test.state.phase.value).toBe("intro_transition");
    expect(test.state.airlockReady.value).toBe(false);
    vi.mocked(test.scene.morueInit).mock.calls[0]?.[0]?.onAct?.("threshold");
    expect(test.state.airlockReady.value).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);

    const events = vi.mocked(test.voice.speak).mock.calls.map(([event]) => event);
    expect(events.filter((event) => event === "signature_classified")).toHaveLength(1);
    expect(events).not.toContain("welcome");
    expect(test.state.phase.value).toBe("intro_transition");
    expect(test.scene.finishMorueInit).not.toHaveBeenCalled();
    expect(test.scene.accessTerminalFocus).not.toHaveBeenCalled();
    test.scope.stop();
  });

  it("crosses the airlock without focusing the terminal", () => {
    const test = harness(makeClient(), makeVoice(), false);

    test.state.skipIntro();
    test.state.skipIntro();

    expect(test.voice.stop).toHaveBeenCalledWith(0);
    expect(test.scene.enterLab).toHaveBeenCalledTimes(1);
    expect(test.scene.enterLab).toHaveBeenCalledWith(
      expect.objectContaining({ reducedMotion: false }),
    );
    expect(test.scene.accessTerminalFocus).not.toHaveBeenCalled();
    expect(test.state.phase.value).toBe("inside");
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([event]) => event === "welcome",
    )).toHaveLength(1);
    test.scope.stop();
  });

  it("zooms the access terminal only after an explicit approach", () => {
    const test = harness(makeClient(), makeVoice(), false);

    test.state.skipIntro();
    test.state.openAccessTerminal();
    test.state.openAccessTerminal();

    expect(test.scene.accessTerminalFocus).toHaveBeenCalledTimes(1);
    expect(test.state.phase.value).toBe("access_terminal");
    test.scope.stop();
  });

  it("passes reduced motion and keeps the short UI phase timing", async () => {
    vi.mocked(matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const test = harness(makeClient(), makeVoice(), false);

    expect(test.scene.morueInit).toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: true }));
    expect(test.state.phase.value).toBe("boot");
    vi.mocked(test.scene.morueInit).mock.calls[0]?.[0]?.onAct?.("identify");
    expect(test.state.phase.value).toBe("identification");
    vi.mocked(test.scene.morueInit).mock.calls[0]?.[0]?.onAct?.("overview");
    expect(test.state.phase.value).toBe("intro_transition");
    test.state.skipIntro();
    expect(test.scene.enterLab).toHaveBeenCalledWith(
      expect.objectContaining({ reducedMotion: true }),
    );
    test.scope.stop();
  });

  it("deduplicates intro startup across repeated setup requests", () => {
    const test = harness(makeClient(), makeVoice(), false);

    test.state.startIntro();
    test.state.startIntro();

    expect(test.scene.morueInit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([event]) => event === "morue_init",
    )).toHaveLength(1);
    test.scope.stop();
  });

  it("selects initiate mode without creating before code entry", () => {
    const test = harness();
    expect(test.state.phase.value).toBe("access_terminal");
    expect(test.state.accessMode.value).toBeNull();

    test.state.selectAccessMode("initiate");

    expect(test.state.accessMode.value).toBe("initiate");
    expect(test.client.createSession).not.toHaveBeenCalled();
    test.scope.stop();
  });

  it("creates with the entered authorization code and waits at one participant", async () => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("z9z9");
    await vi.advanceTimersByTimeAsync(20);

    expect(test.state.accessCode.value).toBe("Z9-Z9");
    expect(test.client.createSession).toHaveBeenCalledWith("Z9-Z9");
    expect(test.state.generatedSessionCode.value).toBe("Z9-Z9");
    expect(test.state.phase.value).toBe("waiting_participant");
    expect(test.voice.speak).toHaveBeenCalledWith(
      "waiting_second_subject",
      { dedupeKey: "room-internal", once: true },
    );
    expect(test.scene.accessGranted).not.toHaveBeenCalled();
    test.state.openChamber("left");
    expect(test.state.activeChamber.value).toBeNull();
    test.scope.stop();
  });

  it("joins by access code after debounce and never sends a subject id", async () => {
    const test = harness(makeClient(room([participant2, projection.player])));
    test.state.selectAccessMode("join");
    test.state.updateAccessCode("z9z9");
    await vi.advanceTimersByTimeAsync(20);

    expect(test.client.joinSession).toHaveBeenCalledWith("Z9-Z9");
    expect(JSON.stringify(vi.mocked(test.client.joinSession).mock.calls)).not.toContain("subjectId");
    expect(test.state.phase.value).toBe("access_granted");
    test.scope.stop();
  });

  it("explains why the initiator cannot act as the second browser identity", async () => {
    const test = harness();
    test.state.selectAccessMode("join");
    test.state.updateAccessCode("z9z9");
    await vi.advanceTimersByTimeAsync(20);

    expect(test.state.phase.value).toBe("access_terminal");
    expect(test.state.error.value).toBe("same_identity");
    expect(test.client.subscribe).not.toHaveBeenCalled();
    test.scope.stop();
  });

  it("cancels automatic submission when the formatted code becomes incomplete", async () => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("z9z9");
    await vi.advanceTimersByTimeAsync(10);
    test.state.updateAccessCode("z9");
    await vi.advanceTimersByTimeAsync(20);

    expect(test.state.accessCode.value).toBe("Z9");
    expect(test.client.createSession).not.toHaveBeenCalled();
    test.scope.stop();
  });

  it("opens chambers exactly once when the WebSocket snapshot reaches two participants", async () => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);
    const ready = room([projection.player, participant2]);
    test.client.push(ready);
    test.client.push(ready);

    expect(test.scene.accessGranted).toHaveBeenCalledTimes(1);
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([event]) => event === "second_subject_detected",
    )).toHaveLength(1);
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([event]) => event === "incubator_ready",
    )).toHaveLength(1);
    expect(test.state.phase.value).toBe("access_granted");
    await vi.advanceTimersByTimeAsync(10);
    expect(test.state.phase.value).toBe("waiting");
    expect(test.scene.loadSubjects).toHaveBeenCalledTimes(1);
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([event]) => event === "biometric_required",
    )).toHaveLength(1);
    test.state.openChamber("left");
    test.state.openChamber("left");
    expect(test.state.activeChamber.value).toBe("left");
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([event]) => event === "fingerprints",
    )).toHaveLength(1);
    test.scope.stop();
  });

  it.each([
    ["unauthorized", "unauthorized"],
    ["rate_limited", "rate_limited"],
    ["network_error", "network_error"],
  ] as const)("surfaces %s transport failures soberly", async (code, expected) => {
    const client = makeClient();
    vi.mocked(client.createSession).mockRejectedValueOnce(new IncubatorTransportError(code));
    const test = harness(client);
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);
    expect(test.state.error.value).toBe(expected);
    if (code === "unauthorized") {
      expect(test.voice.speak).toHaveBeenCalledWith(
        "access_denied",
        expect.objectContaining({ once: true }),
      );
    }
    test.scope.stop();
  });

  it.each(["unknown_session", "invalid_state", "access_exhausted"] as const)(
    "masks the %s access denial",
    async (reason) => {
      const client = makeClient();
      vi.mocked(client.createSession).mockResolvedValueOnce({ ok: false, reason });
      const test = harness(client);
      test.state.selectAccessMode("initiate");
      test.state.updateAccessCode("Z9-Z9");
      await vi.advanceTimersByTimeAsync(20);
      expect(test.state.error.value).toBe("access_unavailable");
      test.scope.stop();
    },
  );

  it("clears the code and mode on reset or back", () => {
    const test = harness();
    test.state.selectAccessMode("join");
    test.state.updateAccessCode("Z9-Z9");
    test.state.handleEscape();
    expect(test.state.accessMode.value).toBeNull();
    expect(test.state.accessCode.value).toBe("");

    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    test.state.resetConsole();
    expect(test.state.accessMode.value).toBeNull();
    expect(test.state.accessCode.value).toBe("");
    test.scope.stop();
  });

  it("uses an explicitly non-production room-code fixture", () => {
    expect(room().accessCode).toBe("Z9-Z9");
  });

  it("uses the supplied authorization code as the mock room code", async () => {
    const client = createMockRoomFingerprintClient(projection.player.id);
    const result = await client.createSession("Z9-Z9");
    expect(result.ok && result.snapshot.accessCode).toBe("Z9-Z9");
    client.destroy();
  });

  it("unsubscribes and destroys the WebSocket transport on scope disposal", async () => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);
    test.scope.stop();
    expect(test.client.destroy).toHaveBeenCalledTimes(1);
  });

  it("leaves misleading waiting state when the transport loses the room", async () => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);
    expect(test.state.phase.value).toBe("waiting_participant");

    test.client.pushTransport({
      type: "session_unavailable",
      reason: "unknown_session",
    });

    expect(test.state.phase.value).toBe("cancelled");
    expect(test.state.error.value).toBe("session_interrupted");
    expect(test.state.lastCode.value).toBeNull();
    test.state.resetConsole();
    expect(test.state.phase.value).toBe("access_terminal");
    expect(test.state.error.value).toBeNull();
    test.scope.stop();
  });

  it("speaks syncing once and its real interruption once", async () => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);
    const ready = room([projection.player, participant2]);
    test.client.push(ready);
    await vi.advanceTimersByTimeAsync(10);
    const syncing = { ...ready, state: "SYNCING" as const };
    test.client.push(syncing);
    test.client.push(syncing);
    test.client.push({ ...ready, state: "ONE_FINGERPRINT" });
    test.client.push({ ...ready, state: "ONE_FINGERPRINT" });

    const events = vi.mocked(test.voice.speak).mock.calls.map(([event]) => event);
    expect(events.filter((event) => event === "synchronization")).toHaveLength(1);
    expect(events.filter((event) => event === "synchronization_interrupted")).toHaveLength(1);
    test.scope.stop();
  });

  it.each([
    ["0", "result_0"],
    ["1", "result_1"],
    ["M", "result_m"],
  ] as const)("uses the symmetric result table for %s", async (code, event) => {
    const test = harness();
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);
    const ready = room([projection.player, participant2]);
    test.client.push(ready);
    await vi.advanceTimersByTimeAsync(10);
    const analyzing = {
      ...ready,
      state: "ANALYZING" as const,
      chambers: {
        left: { subjectId: projection.player.id, pressed: true },
        right: { subjectId: participant2.id, pressed: true },
      },
    };
    test.client.push(analyzing);
    test.client.push({
      ...analyzing,
      state: "RESOLVED",
      runId: `run-${code}`,
      result: code,
    });
    test.client.push({
      ...analyzing,
      state: "RESOLVED",
      runId: `run-${code}`,
      result: code,
    });

    expect(test.voice.preload).toHaveBeenCalledWith("results");
    expect(vi.mocked(test.voice.speak).mock.calls.filter(
      ([spoken]) => spoken === event,
    )).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(test.scene.revealResult).toHaveBeenCalledTimes(1);
    expect(test.scene.revealResult).toHaveBeenCalledWith(code);
    test.scope.stop();
  });

  it("keeps the public denial mapper conservative", () => {
    expect(mapPublicDenialToVoice("access_denied")).toBe("access_denied");
    expect(mapPublicDenialToVoice("access_exhausted")).toBe("access_denied");
    expect(mapPublicDenialToVoice("experiment_already_done")).toBeNull();
    expect(mapPublicDenialToVoice("protocol_stable")).toBeNull();
  });

  it("continues when voice assets are unavailable", async () => {
    const test = harness(makeClient(), makeVoice(false));
    test.state.selectAccessMode("initiate");
    test.state.updateAccessCode("Z9-Z9");
    await vi.advanceTimersByTimeAsync(20);

    expect(test.state.phase.value).toBe("waiting_participant");
    expect(test.client.createSession).toHaveBeenCalledTimes(1);
    test.scope.stop();
  });
});
