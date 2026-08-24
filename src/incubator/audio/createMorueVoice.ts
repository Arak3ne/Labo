import { Howl, Howler, type HowlOptions } from "howler";
import {
  discoverMorueVoiceAssets,
  type MorueVoiceAssetLoader,
  type MorueVoiceEvent,
} from "./morueVoiceManifest";

export type MorueVoicePreloadGroup = "intro" | "incubation" | "results";
export type MorueVoiceErrorCode = "asset_missing" | "load_failed" | "play_failed";

export interface MorueVoiceError {
  code: MorueVoiceErrorCode;
  event: MorueVoiceEvent;
}

export interface MorueVoiceState {
  status: "idle" | "loading" | "playing" | "stopping" | "destroyed";
  event?: MorueVoiceEvent;
  lastError?: MorueVoiceError;
}

export interface MorueSpeakOptions {
  dedupeKey?: string;
  once?: boolean;
  onEnded?: () => void;
}

export interface MorueVoiceApi {
  speak(event: MorueVoiceEvent, options?: MorueSpeakOptions): boolean;
  stop(fadeMs?: number): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  preload(
    groups?: MorueVoicePreloadGroup | readonly MorueVoicePreloadGroup[],
  ): Promise<void>;
  getState(): Readonly<MorueVoiceState>;
  destroy(): void;
}

interface MorueVoicePolicy {
  priority: 1 | 2 | 3;
  volume: number;
  fadeMs: number;
  cooldownMs: number;
  replaceEqual: boolean;
}

interface MorueHowl {
  play(): number | null;
  stop(id?: number): MorueHowl;
  fade(from: number, to: number, duration: number, id?: number): MorueHowl;
  volume(volume: number, id?: number): MorueHowl;
  mute(muted: boolean): MorueHowl;
  load(): MorueHowl;
  state(): "unloaded" | "loading" | "loaded";
  once(event: string, listener: (...args: unknown[]) => void, id?: number): MorueHowl;
  off(): MorueHowl;
  unload(): null;
}

export interface CreateMorueVoiceOptions {
  assets?: Partial<Record<MorueVoiceEvent, MorueVoiceAssetLoader>>;
  createHowl?: (options: HowlOptions) => MorueHowl;
  onError?: (error: MorueVoiceError) => void;
  preloadIntro?: boolean;
  now?: () => number;
}

const INTRO_EVENTS: readonly MorueVoiceEvent[] = [
  "morue_init",
  "identification",
  "access_granted",
  "welcome",
];

const RESULT_EVENTS: readonly MorueVoiceEvent[] = [
  "result_0",
  "result_1",
  "result_m",
];

const INCUBATION_EVENTS: readonly MorueVoiceEvent[] = [
  "signature_classified",
  "waiting_second_subject",
  "second_subject_detected",
  "biometric_required",
  "fingerprints",
  "synchronization",
  "analysis",
  "access_denied",
  "experiment_already_done",
  "synchronization_interrupted",
  "protocol_unstable",
  "protocol_stable",
  "incubator_ready",
];

export const MORUE_PRELOAD_GROUPS: Readonly<
  Record<MorueVoicePreloadGroup, readonly MorueVoiceEvent[]>
> = {
  intro: INTRO_EVENTS,
  incubation: INCUBATION_EVENTS,
  results: RESULT_EVENTS,
};

const INFORMATION_POLICY: MorueVoicePolicy = {
  priority: 1,
  volume: 0.86,
  fadeMs: 90,
  cooldownMs: 1_200,
  replaceEqual: false,
};

const INTRO_BOOT_POLICY: MorueVoicePolicy = {
  priority: 2,
  volume: 0.9,
  fadeMs: 80,
  cooldownMs: 400,
  replaceEqual: true,
};

const INCUBATION_POLICY: MorueVoicePolicy = {
  priority: 2,
  volume: 0.9,
  fadeMs: 90,
  cooldownMs: 1_000,
  replaceEqual: false,
};

const PROTOCOL_POLICY: MorueVoicePolicy = {
  priority: 3,
  volume: 0.94,
  fadeMs: 80,
  cooldownMs: 1_200,
  replaceEqual: true,
};

// All three backend result lines deliberately share this exact policy object.
const RESULT_POLICY: MorueVoicePolicy = {
  priority: 3,
  volume: 1,
  fadeMs: 80,
  cooldownMs: 2_500,
  replaceEqual: true,
};

export const MORUE_VOICE_POLICIES: Readonly<
  Record<MorueVoiceEvent, Readonly<MorueVoicePolicy>>
> = {
  morue_init: INTRO_BOOT_POLICY,
  identification: INFORMATION_POLICY,
  access_granted: INCUBATION_POLICY,
  welcome: INFORMATION_POLICY,
  signature_classified: INFORMATION_POLICY,
  waiting_second_subject: INFORMATION_POLICY,
  second_subject_detected: INCUBATION_POLICY,
  biometric_required: INFORMATION_POLICY,
  fingerprints: INFORMATION_POLICY,
  synchronization: INCUBATION_POLICY,
  analysis: PROTOCOL_POLICY,
  result_0: RESULT_POLICY,
  result_1: RESULT_POLICY,
  result_m: RESULT_POLICY,
  access_denied: PROTOCOL_POLICY,
  experiment_already_done: PROTOCOL_POLICY,
  synchronization_interrupted: PROTOCOL_POLICY,
  protocol_unstable: PROTOCOL_POLICY,
  protocol_stable: PROTOCOL_POLICY,
  incubator_ready: INCUBATION_POLICY,
};

interface VoiceRequest {
  event: MorueVoiceEvent;
  key: string;
  once: boolean;
  token: number;
  onEnded?: () => void;
}

interface ActiveVoice extends VoiceRequest {
  howl: MorueHowl;
  id: number;
  gain: number;
}

let sharedMorueVoice: MorueVoiceApi | null = null;

function resumeHowlerContext(): Promise<void> {
  try {
    Howler.autoSuspend = false;
    const context = Howler.ctx;
    if (!context || context.state === "running") return Promise.resolve();
    return context.resume().then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

export function unlockMorueAudio(): Promise<void> {
  return resumeHowlerContext();
}

export function getMorueVoice(): MorueVoiceApi {
  sharedMorueVoice ??= createMorueVoice();
  return sharedMorueVoice;
}

export function destroyMorueVoice(): void {
  sharedMorueVoice?.destroy();
  sharedMorueVoice = null;
}

export function createMorueVoice(options: CreateMorueVoiceOptions = {}): MorueVoiceApi {
  const assets = options.assets ?? discoverMorueVoiceAssets();
  const makeHowl =
    options.createHowl ??
    ((howlOptions: HowlOptions) => new Howl(howlOptions) as unknown as MorueHowl);
  const now = options.now ?? Date.now;
  const howls = new Map<MorueVoiceEvent, MorueHowl>();
  const loadPromises = new Map<MorueVoiceEvent, Promise<MorueHowl | undefined>>();
  const playedAt = new Map<string, number>();
  const playedOnce = new Set<string>();
  const timers = new Set<number>();
  const gestureAbort = typeof document === "undefined" ? null : new AbortController();
  let state: MorueVoiceState = { status: "idle" };
  let active: ActiveVoice | null = null;
  let pending: VoiceRequest | null = null;
  let requestToken = 0;
  let volume = 1;
  let muted = false;
  let destroyed = false;

  function reportError(event: MorueVoiceEvent, code: MorueVoiceErrorCode): void {
    const error = { event, code };
    state = {
      status: active ? "playing" : "idle",
      event: active?.event,
      lastError: error,
    };
    options.onError?.(error);
  }

  function schedule(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!destroyed) callback();
    }, delay);
    timers.add(timer);
  }

  function waitUntilLoaded(howl: MorueHowl, event: MorueVoiceEvent): Promise<MorueHowl | undefined> {
    if (howl.state() === "loaded") return Promise.resolve(howl);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: MorueHowl | undefined) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      howl.once("load", () => finish(destroyed ? undefined : howl));
      howl.once("loaderror", () => {
        reportError(event, "load_failed");
        finish(undefined);
      });

      if (howl.state() === "loaded") {
        finish(destroyed ? undefined : howl);
        return;
      }
      if (howl.state() === "unloaded") howl.load();
    });
  }

  function loadVoice(event: MorueVoiceEvent): Promise<MorueHowl | undefined> {
    const existing = howls.get(event);
    if (existing?.state() === "loaded") return Promise.resolve(existing);

    const inFlight = loadPromises.get(event);
    if (inFlight) return inFlight;

    const assetLoader = assets[event];
    if (!assetLoader) return Promise.resolve(undefined);

    const promise = assetLoader()
      .then((source) => {
        if (destroyed) return undefined;
        const howl =
          howls.get(event) ??
          makeHowl({
            src: [source],
            format: ["mp3"],
            preload: false,
            volume: MORUE_VOICE_POLICIES[event].volume * volume,
            mute: muted,
          });
        howls.set(event, howl);
        return waitUntilLoaded(howl, event);
      })
      .catch(() => {
        if (!destroyed) reportError(event, "load_failed");
        return undefined;
      })
      .finally(() => loadPromises.delete(event));

    loadPromises.set(event, promise);
    return promise;
  }

  function notifyEnded(request: { onEnded?: () => void }): void {
    const ended = request.onEnded;
    request.onEnded = undefined;
    ended?.();
  }

  function clearActive(voice: ActiveVoice): void {
    if (active !== voice) return;
    active = null;
    state = { status: "idle", lastError: state.lastError };
  }

  function requestStillCurrent(request: VoiceRequest): boolean {
    return !destroyed && pending?.token === request.token;
  }

  function whenUserGesture(callback: () => void): void {
    if (typeof document === "undefined") {
      callback();
      return;
    }
    const run = () => {
      document.removeEventListener("pointerdown", run, true);
      document.removeEventListener("keydown", run, true);
      callback();
    };
    document.addEventListener("pointerdown", run, true);
    document.addEventListener("keydown", run, true);
  }

  function beginPlayback(
    request: VoiceRequest,
    howl: MorueHowl,
    phase: "initial" | "resumed" | "gesture",
  ): void {
    if (!requestStillCurrent(request)) {
      notifyEnded(request);
      return;
    }

    const policy = MORUE_VOICE_POLICIES[request.event];
    const gain = policy.volume * volume;
    const fail = () => {
      pending = request;
      howl.stop();
      if (phase === "initial") {
        void resumeHowlerContext().then(() => beginPlayback(request, howl, "resumed"));
        return;
      }
      if (phase === "resumed") {
        whenUserGesture(() => {
          void resumeHowlerContext().then(() => beginPlayback(request, howl, "gesture"));
        });
        return;
      }
      pending = null;
      reportError(request.event, "play_failed");
      notifyEnded(request);
    };

    const id = howl.play();
    if (!id) {
      fail();
      return;
    }

    howl.once("end", () => {
      if (active?.token !== request.token) return;
      const voice = active;
      if (!voice) return;
      clearActive(voice);
      notifyEnded(voice);
    }, id);
    howl.once("playerror", () => {
      if (pending?.token !== request.token && active?.token !== request.token) return;
      if (active?.token === request.token) clearActive(active);
      fail();
    }, id);

    howl.volume(gain, id);
    howl.mute(muted);
    active = { ...request, howl, id, gain };
    pending = null;
    playedAt.set(request.key, now());
    if (request.once) playedOnce.add(request.key);
    state = { status: "playing", event: request.event, lastError: state.lastError };
  }

  function playRequest(request: VoiceRequest): void {
    state = { status: "loading", event: request.event, lastError: state.lastError };
    void resumeHowlerContext()
      .then(() => loadVoice(request.event))
      .then((howl) => {
        if (!requestStillCurrent(request)) {
          notifyEnded(request);
          return;
        }
        if (!howl) {
          pending = null;
          if (state.lastError?.event !== request.event) {
            reportError(request.event, "load_failed");
          }
          notifyEnded(request);
          return;
        }
        beginPlayback(request, howl, "initial");
      })
      .catch(() => {
        if (!requestStillCurrent(request)) {
          notifyEnded(request);
          return;
        }
        pending = null;
        reportError(request.event, "play_failed");
        notifyEnded(request);
      });
  }

  function stopActive(fadeMs: number, after?: () => void): void {
    const voice = active;
    if (!voice) {
      after?.();
      return;
    }

    state = { status: "stopping", event: voice.event, lastError: state.lastError };
    if (fadeMs <= 0) {
      voice.howl.stop(voice.id);
      clearActive(voice);
      notifyEnded(voice);
      after?.();
      return;
    }

    voice.howl.fade(voice.gain, 0, fadeMs, voice.id);
    schedule(() => {
      voice.howl.stop(voice.id);
      if (active === voice) clearActive(voice);
      notifyEnded(voice);
      after?.();
    }, fadeMs);
  }

  const api: MorueVoiceApi = {
    speak(event, speakOptions = {}) {
      if (destroyed) return false;
      void resumeHowlerContext();
      const policy = MORUE_VOICE_POLICIES[event];
      const key = `${event}:${speakOptions.dedupeKey ?? "default"}`;
      const current = active ?? pending;

      if (!assets[event]) {
        reportError(event, "asset_missing");
        return false;
      }
      if (current?.event === event && current.key === key) return false;
      if (speakOptions.once && playedOnce.has(key)) return false;
      if (now() - (playedAt.get(key) ?? -Infinity) < policy.cooldownMs) return false;
      if (current) {
        const currentPolicy = MORUE_VOICE_POLICIES[current.event];
        if (policy.priority < currentPolicy.priority) return false;
        if (policy.priority === currentPolicy.priority && !policy.replaceEqual) return false;
      }

      const request: VoiceRequest = {
        event,
        key,
        once: speakOptions.once ?? false,
        token: ++requestToken,
        onEnded: speakOptions.onEnded,
      };
      pending = request;

      if (active) {
        stopActive(MORUE_VOICE_POLICIES[active.event].fadeMs, () => {
          if (pending?.token === request.token) playRequest(request);
        });
      } else {
        playRequest(request);
      }
      return true;
    },
    stop(fadeMs = 80) {
      if (destroyed) return;
      const waiting = pending;
      requestToken += 1;
      pending = null;
      if (waiting) notifyEnded(waiting);
      stopActive(Math.max(0, fadeMs));
    },
    setVolume(nextVolume) {
      volume = Math.max(0, Math.min(1, nextVolume));
      for (const [event, howl] of howls) {
        howl.volume(MORUE_VOICE_POLICIES[event].volume * volume);
      }
      if (active) {
        active.gain = MORUE_VOICE_POLICIES[active.event].volume * volume;
        active.howl.volume(active.gain, active.id);
      }
    },
    getVolume() {
      return volume;
    },
    mute() {
      muted = true;
      for (const howl of howls.values()) howl.mute(true);
    },
    unmute() {
      muted = false;
      for (const howl of howls.values()) howl.mute(false);
    },
    isMuted() {
      return muted;
    },
    async preload(groups = "intro") {
      if (destroyed) return;
      const requestedGroups = typeof groups === "string" ? [groups] : groups;
      const events = new Set(requestedGroups.flatMap((group) => MORUE_PRELOAD_GROUPS[group]));
      await Promise.all(
        [...events].filter((event) => assets[event]).map((event) => loadVoice(event)),
      );
    },
    getState() {
      return { ...state };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      gestureAbort?.abort();
      requestToken += 1;
      pending = null;
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      active?.howl.stop(active.id);
      active = null;
      for (const howl of howls.values()) {
        howl.off();
        howl.unload();
      }
      howls.clear();
      loadPromises.clear();
      playedAt.clear();
      playedOnce.clear();
      state = { status: "destroyed", lastError: state.lastError };
    },
  };

  if (gestureAbort && typeof document !== "undefined") {
    const unlock = () => {
      void resumeHowlerContext();
    };
    document.addEventListener("pointerdown", unlock, { capture: true, signal: gestureAbort.signal });
    document.addEventListener("keydown", unlock, { capture: true, signal: gestureAbort.signal });
  }

  if (options.preloadIntro ?? true) void api.preload("intro");

  return api;
}
