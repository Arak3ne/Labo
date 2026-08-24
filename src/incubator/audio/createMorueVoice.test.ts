import type { HowlOptions } from "howler";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMorueVoice,
  MORUE_VOICE_POLICIES,
  type CreateMorueVoiceOptions,
} from "./createMorueVoice";
import type {
  MorueVoiceAssetLoader,
  MorueVoiceEvent,
} from "./morueVoiceManifest";

type Listener = (...args: unknown[]) => void;

class FakeHowl {
  static instances: FakeHowl[] = [];

  readonly source: string;
  readonly plays: number[] = [];
  readonly stops: number[] = [];
  readonly fades: Array<{ from: number; to: number; duration: number; id?: number }> = [];
  readonly volumeChanges: Array<{ volume: number; id?: number }> = [];
  readonly muteChanges: boolean[] = [];
  loadCount = 0;
  unloaded = false;
  loaded = false;
  private nextId = 1;
  private listeners = new Map<string, Array<{ listener: Listener; id?: number }>>();

  constructor(options: HowlOptions) {
    this.source = String(options.src?.[0]);
    FakeHowl.instances.push(this);
  }

  play() {
    const id = this.nextId++;
    this.plays.push(id);
    return id;
  }

  stop(id?: number) {
    if (id !== undefined) this.stops.push(id);
    return this;
  }

  fade(from: number, to: number, duration: number, id?: number) {
    this.fades.push({ from, to, duration, id });
    return this;
  }

  volume(volume: number, id?: number) {
    this.volumeChanges.push({ volume, id });
    return this;
  }

  mute(muted: boolean) {
    this.muteChanges.push(muted);
    return this;
  }

  load() {
    this.loadCount += 1;
    this.loaded = true;
    this.emit("load");
    return this;
  }

  state() {
    return this.loaded ? ("loaded" as const) : ("unloaded" as const);
  }

  once(event: string, listener: Listener, id?: number) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push({ listener, id });
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: string, id?: number) {
    const listeners = this.listeners.get(event) ?? [];
    this.listeners.delete(event);
    for (const registered of listeners) {
      if (registered.id === undefined || registered.id === id) registered.listener(id);
    }
  }

  off() {
    this.listeners.clear();
    return this;
  }

  unload() {
    this.unloaded = true;
    return null;
  }
}

function assets(...events: MorueVoiceEvent[]) {
  return Object.fromEntries(
    events.map((event) => [event, vi.fn(async () => `/${event}.mp3`)]),
  ) as Partial<Record<MorueVoiceEvent, MorueVoiceAssetLoader>>;
}

function createTestVoice(
  voiceAssets: Partial<Record<MorueVoiceEvent, MorueVoiceAssetLoader>>,
  overrides: Partial<CreateMorueVoiceOptions> = {},
) {
  return createMorueVoice({
    assets: voiceAssets,
    createHowl: (options) => new FakeHowl(options),
    preloadIntro: false,
    ...overrides,
  });
}

async function flushLoading() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe("createMorueVoice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeHowl.instances.length = 0;
    vi.stubGlobal("window", {
      setTimeout: (callback: TimerHandler, delay?: number) => setTimeout(callback, delay),
      clearTimeout: (id: number) => clearTimeout(id),
    });
  });

  it("stays silent and testable when an asset is absent", () => {
    const onError = vi.fn();
    const morue = createTestVoice({}, { onError });

    expect(morue.speak("identification")).toBe(false);
    expect(FakeHowl.instances).toHaveLength(0);
    expect(morue.getState().lastError).toEqual({
      code: "asset_missing",
      event: "identification",
    });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("preloads only the requested groups without playing", async () => {
    const voiceAssets = assets("morue_init", "analysis", "result_0");
    const morue = createTestVoice(voiceAssets);

    await morue.preload("intro");
    expect(voiceAssets.morue_init).toHaveBeenCalledOnce();
    expect(voiceAssets.analysis).not.toHaveBeenCalled();
    expect(FakeHowl.instances.every((howl) => howl.plays.length === 0)).toBe(true);

    await morue.preload(["incubation", "results"]);
    expect(voiceAssets.analysis).toHaveBeenCalledOnce();
    expect(voiceAssets.result_0).toHaveBeenCalledOnce();
  });

  it("never overlaps voices and obeys interruption priority", async () => {
    const morue = createTestVoice(assets("identification", "welcome", "access_denied"));

    expect(morue.speak("identification")).toBe(true);
    await flushLoading();
    expect(morue.speak("welcome")).toBe(false);
    expect(morue.speak("access_denied")).toBe(true);

    const identification = FakeHowl.instances[0];
    expect(identification.fades).toHaveLength(1);
    expect(FakeHowl.instances).toHaveLength(1);

    vi.advanceTimersByTime(90);
    await flushLoading();
    expect(identification.stops).toEqual([1]);
    expect(FakeHowl.instances[1]?.plays).toEqual([1]);
  });

  it("keeps result 0, 1 and M strictly identical", () => {
    expect(MORUE_VOICE_POLICIES.result_0).toBe(MORUE_VOICE_POLICIES.result_1);
    expect(MORUE_VOICE_POLICIES.result_1).toBe(MORUE_VOICE_POLICIES.result_m);
  });

  it("deduplicates active, cooldown and once calls", async () => {
    let clock = 1_000;
    const morue = createTestVoice(assets("identification"), { now: () => clock });

    expect(morue.speak("identification", { dedupeKey: "route-a", once: true })).toBe(true);
    expect(morue.speak("identification", { dedupeKey: "route-a", once: true })).toBe(false);
    await flushLoading();
    FakeHowl.instances[0]?.emit("end", 1);
    clock += 5_000;

    expect(morue.speak("identification", { dedupeKey: "route-a", once: true })).toBe(false);
    expect(morue.speak("identification", { dedupeKey: "route-b" })).toBe(true);
    await flushLoading();
    FakeHowl.instances[0]?.emit("end", 2);
    expect(morue.speak("identification", { dedupeKey: "route-b" })).toBe(false);
  });

  it("clamps local volume and scopes mute to voice Howls", async () => {
    const morue = createTestVoice(assets("analysis"));
    await morue.preload("incubation");
    const howl = FakeHowl.instances[0];

    morue.setVolume(2);
    morue.mute();
    expect(morue.getVolume()).toBe(1);
    expect(morue.isMuted()).toBe(true);
    expect(howl.muteChanges.at(-1)).toBe(true);

    morue.setVolume(-1);
    morue.unmute();
    expect(morue.getVolume()).toBe(0);
    expect(morue.isMuted()).toBe(false);
    expect(howl.volumeChanges.at(-1)?.volume).toBe(0);
  });

  it("ends a waiting line when a higher-priority request replaces it before playback", async () => {
    const onEnded = vi.fn();
    const morue = createTestVoice(assets("identification", "access_denied"));

    expect(morue.speak("identification", { onEnded })).toBe(true);
    expect(morue.speak("access_denied")).toBe(true);
    await flushLoading();

    expect(onEnded).toHaveBeenCalledOnce();
    expect(FakeHowl.instances.some((howl) => howl.plays.length > 0)).toBe(true);
  });

  it("notifies onEnded when a line finishes or is stopped", async () => {
    const onEnded = vi.fn();
    const morue = createTestVoice(assets("welcome", "identification"));

    expect(morue.speak("welcome", { onEnded })).toBe(true);
    await flushLoading();
    FakeHowl.instances[0]?.emit("end", 1);
    expect(onEnded).toHaveBeenCalledOnce();

    const onStopped = vi.fn();
    expect(morue.speak("identification", { onEnded: onStopped })).toBe(true);
    await flushLoading();
    morue.stop(0);
    expect(onStopped).toHaveBeenCalledOnce();
  });

  it("stops with a fade, destroys resources and never replays accidentally", async () => {
    const morue = createTestVoice(assets("analysis"));
    morue.speak("analysis");
    await flushLoading();
    const howl = FakeHowl.instances[0];

    morue.stop(40);
    expect(howl.fades.at(-1)?.duration).toBe(40);
    vi.advanceTimersByTime(40);
    expect(howl.stops).toEqual([1]);

    morue.destroy();
    expect(howl.unloaded).toBe(true);
    expect(morue.speak("analysis")).toBe(false);
    vi.runAllTimers();
    expect(howl.plays).toHaveLength(1);
    expect(morue.getState().status).toBe("destroyed");
  });
});
