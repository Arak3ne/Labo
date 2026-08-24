import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const howlerState = vi.hoisted(() => ({
  instances: [] as Array<{
    plays: Array<{ cue: string; id: number }>;
    stops: Array<number | undefined>;
    fades: Array<{ from: number; to: number; duration: number; id: number }>;
    groupVolume: number;
    muted: boolean;
    unloaded: boolean;
  }>,
}));

vi.mock("howler", () => ({
  Howl: class {
    plays: Array<{ cue: string; id: number }> = [];
    stops: Array<number | undefined> = [];
    fades: Array<{ from: number; to: number; duration: number; id: number }> = [];
    groupVolume: number;
    muted: boolean;
    unloaded = false;
    #nextId = 1;

    constructor(options: { volume: number; mute: boolean }) {
      this.groupVolume = options.volume;
      this.muted = options.mute;
      howlerState.instances.push(this);
    }

    play(cue: string) {
      const id = this.#nextId++;
      this.plays.push({ cue, id });
      return id;
    }

    volume(value: number) {
      if (arguments.length === 1) this.groupVolume = value;
      return this;
    }

    mute(value: boolean) {
      this.muted = value;
      return this;
    }

    rate() {
      return this;
    }

    fade(from: number, to: number, duration: number, id: number) {
      this.fades.push({ from, to, duration, id });
      return this;
    }

    once() {
      return this;
    }

    stop(id?: number) {
      this.stops.push(id);
      return this;
    }

    off() {
      return this;
    }

    unload() {
      this.unloaded = true;
      return null;
    }
  },
}));

import { createIncubatorAudio } from "./createIncubatorAudio";

function currentHowl() {
  const instance = howlerState.instances.at(-1);
  if (!instance) throw new Error("Expected a Howl instance");
  return instance;
}

describe("createIncubatorAudio", () => {
  let visibilityState: DocumentVisibilityState;
  let visibilityTarget: EventTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    howlerState.instances.length = 0;
    visibilityState = "visible";
    visibilityTarget = new EventTarget();
    Object.defineProperty(visibilityTarget, "visibilityState", {
      get: () => visibilityState,
    });
    vi.stubGlobal("document", visibilityTarget);
    vi.stubGlobal("window", {
      setTimeout: (callback: TimerHandler, delay?: number) => setTimeout(callback, delay),
      clearTimeout: (id: number) => clearTimeout(id),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays the intro phases once and settles into idle", () => {
    const audio = createIncubatorAudio();

    audio.introBoot();
    audio.introBoot();
    vi.advanceTimersByTime(180);
    audio.introIdentify();
    audio.introIdentify();
    audio.introEnter();
    audio.introEnter();
    vi.advanceTimersByTime(1_100);

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "idle",
      "focusLeft",
      "loadSubjects",
      "startAnalysis",
      "idle",
    ]);

    audio.introEnter();
    vi.advanceTimersByTime(2_000);
    expect(currentHowl().plays.map(({ cue }) => cue)).toHaveLength(5);

    audio.destroy();
  });

  it("skips pending intro work with fades and converges to idle", () => {
    const audio = createIncubatorAudio();

    audio.introBoot();
    vi.advanceTimersByTime(180);
    const bootId = currentHowl().plays.at(-1)?.id;
    audio.introIdentify();
    audio.introEnter();
    vi.advanceTimersByTime(1_100);

    expect(currentHowl().fades).toContainEqual({
      from: 0.1,
      to: 0,
      duration: 180,
      id: bootId,
    });
    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "idle",
      "focusLeft",
      "loadSubjects",
      "startAnalysis",
      "idle",
    ]);

    audio.destroy();
  });

  it("settles a direct intro skip into the final load and idle ambience", () => {
    const audio = createIncubatorAudio();

    audio.introBoot();
    vi.advanceTimersByTime(180);
    audio.loadSubjects();
    vi.advanceTimersByTime(120);
    vi.advanceTimersByTime(5_000);

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "idle",
      "loadSubjects",
      "idle",
    ]);

    audio.destroy();
  });

  it("resumes an interrupted intro directly in idle without a cue burst", () => {
    const audio = createIncubatorAudio();

    audio.introBoot();
    vi.advanceTimersByTime(180);
    visibilityState = "hidden";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    audio.introIdentify();
    audio.introEnter();
    vi.advanceTimersByTime(2_000);
    visibilityState = "visible";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual(["idle", "idle"]);

    audio.destroy();
  });

  it("cancels every intro timer when destroyed", () => {
    const audio = createIncubatorAudio();

    audio.introBoot();
    vi.advanceTimersByTime(180);
    audio.introEnter();
    const playCount = currentHowl().plays.length;
    audio.destroy();
    audio.introBoot();
    audio.introIdentify();
    audio.introEnter();
    vi.advanceTimersByTime(5_000);

    expect(currentHowl().plays).toHaveLength(playCount);
    expect(currentHowl().unloaded).toBe(true);
  });

  it("runs the analysis timeline once and hits blackout at 7.55 seconds", () => {
    const audio = createIncubatorAudio();

    audio.startAnalysis();
    audio.startAnalysis();
    vi.advanceTimersByTime(7_549);

    expect(currentHowl().plays.map(({ cue }) => cue)).not.toContain("blackout");

    vi.advanceTimersByTime(1);
    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "startAnalysis",
      "chamberLock",
      "scan",
      "analysisLoop",
      "scan",
      "blackout",
    ]);
    expect(currentHowl().fades).toContainEqual({
      from: 0.52,
      to: 0,
      duration: 65,
      id: 4,
    });

    audio.destroy();
  });

  it("holds and releases one fingerprint loop without a cut", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("left");
    audio.fingerprintPress("left");
    const holdId = currentHowl().plays.at(-1)?.id;
    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual(["analysisLoop"]);

    audio.fingerprintRelease("left");
    audio.fingerprintRelease("left");
    expect(currentHowl().fades).toContainEqual({
      from: 0.075,
      to: 0,
      duration: 70,
      id: holdId,
    });
    vi.advanceTimersByTime(80);
    expect(currentHowl().stops.filter((id) => id === holdId)).toHaveLength(1);

    audio.destroy();
  });

  it("keeps the two fingerprint holds independent", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("left");
    audio.fingerprintPress("right");
    const [leftId, rightId] = currentHowl().plays.map(({ id }) => id);
    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "analysisLoop",
      "analysisLoop",
    ]);

    audio.fingerprintRelease("left");
    vi.advanceTimersByTime(80);
    expect(currentHowl().stops).toContain(leftId);
    expect(currentHowl().stops).not.toContain(rightId);

    audio.fingerprintRelease("right");
    vi.advanceTimersByTime(80);
    expect(currentHowl().stops).toContain(rightId);

    audio.destroy();
  });

  it("cancels fingerprint sync on release and returns to waiting ambience", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("left");
    audio.fingerprintSync();
    const syncId = currentHowl().plays.at(-1)?.id;
    audio.fingerprintSync();
    audio.fingerprintRelease("left");
    vi.advanceTimersByTime(2_000);

    expect(currentHowl().stops).toContain(syncId);
    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "analysisLoop",
      "analysisLoop",
      "idle",
    ]);

    audio.destroy();
  });

  it("hands confirmed fingerprint audio to analysis without duplicate impacts", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("right");
    audio.fingerprintSync();
    audio.fingerprintConfirmed();
    audio.fingerprintConfirmed();
    audio.startAnalysis();
    audio.startAnalysis();
    vi.advanceTimersByTime(7_550);

    const cues = currentHowl().plays.map(({ cue }) => cue);
    expect(cues.filter((cue) => cue === "chamberLock")).toHaveLength(1);
    expect(cues).not.toContain("startAnalysis");
    expect(cues.at(-1)).toBe("blackout");

    audio.destroy();
  });

  it("cancels fingerprint layers and pending sync work when hidden", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("left");
    audio.fingerprintSync();
    visibilityState = "hidden";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(2_000);
    visibilityState = "visible";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "analysisLoop",
      "analysisLoop",
      "idle",
    ]);

    audio.destroy();
  });

  it("cleans fingerprint state on reset and destroy", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("left");
    audio.fingerprintSync();
    audio.reset();
    vi.advanceTimersByTime(2_000);
    const playCount = currentHowl().plays.length;
    audio.destroy();
    audio.fingerprintPress("right");
    audio.fingerprintSync();
    audio.fingerprintConfirmed();
    vi.advanceTimersByTime(2_000);

    expect(currentHowl().plays).toHaveLength(playCount);
    expect(currentHowl().unloaded).toBe(true);
  });

  it("keeps terminal focus restrained and scanner holds idempotent", () => {
    const audio = createIncubatorAudio();

    audio.accessTerminalFocus();
    audio.accessTerminalFocus();
    audio.accessScanStart();
    audio.accessScanStart();
    const scanId = currentHowl().plays.at(-1)?.id;

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "focusLeft",
      "analysisLoop",
    ]);
    expect(currentHowl().fades).toContainEqual({
      from: 0,
      to: 0.085,
      duration: 120,
      id: scanId,
    });

    audio.destroy();
  });

  it("cancels only the terminal scanner with a click-free fade", () => {
    const audio = createIncubatorAudio();

    audio.fingerprintPress("left");
    const fingerprintId = currentHowl().plays.at(-1)?.id;
    audio.accessScanStart();
    const scanId = currentHowl().plays.at(-1)?.id;
    audio.accessScanCancel();
    audio.accessScanCancel();
    vi.advanceTimersByTime(130);

    expect(currentHowl().fades).toContainEqual({
      from: 0.085,
      to: 0,
      duration: 120,
      id: scanId,
    });
    expect(currentHowl().stops).toContain(scanId);
    expect(currentHowl().stops).not.toContain(fingerprintId);

    audio.fingerprintRelease("left");
    vi.advanceTimersByTime(80);
    expect(currentHowl().stops).toContain(fingerprintId);

    audio.destroy();
  });

  it("layers a restrained granted response once and returns to idle", () => {
    const audio = createIncubatorAudio();

    audio.accessScanStart();
    const scanId = currentHowl().plays.at(-1)?.id;
    audio.accessGranted();
    audio.accessGranted();
    vi.advanceTimersByTime(920);

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "analysisLoop",
      "chamberLock",
      "startAnalysis",
      "idle",
    ]);
    expect(currentHowl().fades).toContainEqual({
      from: 0.085,
      to: 0,
      duration: 120,
      id: scanId,
    });

    audio.destroy();
  });

  it("clears terminal scanner and granted timers on reset, visibility and destroy", () => {
    const audio = createIncubatorAudio();

    audio.accessScanStart();
    audio.accessGranted();
    audio.reset();
    vi.advanceTimersByTime(2_000);
    expect(currentHowl().plays.map(({ cue }) => cue)).not.toContain("startAnalysis");

    audio.accessScanStart();
    visibilityState = "hidden";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    visibilityState = "visible";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    const playCount = currentHowl().plays.length;

    audio.destroy();
    audio.accessTerminalFocus();
    audio.accessScanStart();
    audio.accessScanCancel();
    audio.accessGranted();
    vi.advanceTimersByTime(2_000);

    expect(currentHowl().plays).toHaveLength(playCount);
    expect(currentHowl().unloaded).toBe(true);
  });

  it("cancels pending analysis cues when reveal interrupts analysis", () => {
    const audio = createIncubatorAudio();

    audio.startAnalysis();
    vi.advanceTimersByTime(2_500);
    audio.revealResult("1");
    vi.advanceTimersByTime(10_000);

    const cues = currentHowl().plays.map(({ cue }) => cue);
    expect(cues.at(-1)).toBe("reveal1");
    expect(cues).not.toContain("blackout");

    audio.destroy();
  });

  it("does not flush delayed cues after a hidden tab resumes", () => {
    const audio = createIncubatorAudio();

    audio.startAnalysis();
    vi.advanceTimersByTime(2_500);
    visibilityState = "hidden";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(10_000);
    visibilityState = "visible";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));

    expect(currentHowl().plays.map(({ cue }) => cue)).toEqual([
      "startAnalysis",
      "chamberLock",
      "scan",
      "analysisLoop",
    ]);

    audio.revealResult("M");
    vi.advanceTimersByTime(240);
    expect(currentHowl().plays.at(-1)?.cue).toBe("revealM");

    audio.destroy();
  });

  it.each([
    ["0", 95],
    ["1", 115],
    ["M", 240],
  ] as const)("aligns reveal %s with its visual impact", (code, delay) => {
    const audio = createIncubatorAudio();

    audio.focusLeft();
    audio.revealResult(code);
    vi.advanceTimersByTime(delay - 1);
    expect(currentHowl().plays.map(({ cue }) => cue)).not.toContain(`reveal${code}`);

    vi.advanceTimersByTime(1);
    expect(currentHowl().plays.at(-1)?.cue).toBe(`reveal${code}`);

    audio.destroy();
  });

  it("keeps cleanup scoped and applies master volume and mute", () => {
    const audio = createIncubatorAudio();

    audio.idle();
    vi.advanceTimersByTime(120);
    const idleId = currentHowl().plays.at(-1)?.id;
    audio.startAnalysis();
    vi.advanceTimersByTime(40);
    audio.revealResult("0");
    vi.advanceTimersByTime(95);
    const revealId = currentHowl().plays.at(-1)?.id;
    vi.advanceTimersByTime(105);

    expect(currentHowl().stops).toContain(idleId);
    expect(currentHowl().stops).not.toContain(revealId);

    audio.setMasterVolume(2);
    audio.setMuted(true);
    expect(audio.getMasterVolume()).toBe(1);
    expect(currentHowl().groupVolume).toBe(1);
    expect(currentHowl().muted).toBe(true);

    audio.destroy();
    expect(currentHowl().unloaded).toBe(true);
  });
});
