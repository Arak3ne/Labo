import { Howl } from "howler";
import type { IncubatorChamber, IncubatorRevealCode } from "../types";
import {
  ANALYSIS_AUDIO_CUES,
  INCUBATOR_AUDIO_SOURCE,
  INCUBATOR_AUDIO_SPRITE,
  type IncubatorAudioCue,
} from "./audioSprite";

const DEFAULT_MASTER_VOLUME = 0.72;
const IDLE_VOLUME = 0.16;
const IDLE_FADE_MS = 120;
const INTRO_BOOT_VOLUME = 0.1;
const INTRO_BOOT_FADE_MS = 320;
const INTRO_TRANSITION_FADE_MS = 180;
const INTRO_ENTER_POWER_DELAY_MS = 620;
const INTRO_ENTER_IDLE_DELAY_MS = 1100;
const FINGERPRINT_FOCUS_VOLUME = 0.09;
const FINGERPRINT_HOLD_VOLUME = 0.075;
const FINGERPRINT_HOLD_FADE_MS = 80;
const FINGERPRINT_RELEASE_FADE_MS = 70;
const FINGERPRINT_SYNC_DURATION_MS = 1800;
const FINGERPRINT_SYNC_VOLUME = 0.23;
const ACCESS_FOCUS_VOLUME = 0.045;
const ACCESS_SCAN_VOLUME = 0.085;
const ACCESS_SCAN_RATE = 0.68;
const ACCESS_SCAN_FADE_MS = 120;
const ACCESS_GRANTED_ENERGY_DELAY_MS = 210;
const ACCESS_GRANTED_IDLE_DELAY_MS = 920;
const DUPLICATE_CUE_WINDOW_MS: Partial<Record<IncubatorAudioCue, number>> = {
  focusLeft: 120,
  focusRight: 120,
  loadSubjects: 750,
};
// PlaygroundRig reveals light at 120/140/260 ms. The synthesized impacts
// begin 25/25/20 ms into their sprites, so these offsets align both transients.
const REVEAL_PLAY_DELAY_MS: Record<IncubatorRevealCode, number> = {
  "0": 95,
  "1": 115,
  M: 240,
};

type AudioMode =
  | "introBoot"
  | "introIdentify"
  | "introEnter"
  | "idle"
  | "fingerprintHold"
  | "fingerprintSync"
  | "fingerprintConfirmed"
  | "analysis"
  | "reveal"
  | "reset";
type ResumeMode = "introBoot" | "idle";

export interface IncubatorAudioApi {
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
  accessTerminalFocus(): void;
  accessScanStart(): void;
  accessScanCancel(): void;
  accessGranted(): void;
  loadSubjects(): void;
  startAnalysis(): void;
  revealResult(code: IncubatorRevealCode): void;
  reset(): void;
  setMasterVolume(volume: number): void;
  setMuted(muted: boolean): void;
  getMasterVolume(): number;
  isMuted(): boolean;
  destroy(): void;
}

let sharedAudio: IncubatorAudioApi | null = null;

export function getIncubatorAudio(): IncubatorAudioApi {
  sharedAudio ??= createIncubatorAudio();
  return sharedAudio;
}

export function destroyIncubatorAudio() {
  sharedAudio?.destroy();
  sharedAudio = null;
}

export function createIncubatorAudio(): IncubatorAudioApi {
  let howl: Howl | null = null;
  let analysisId: number | null = null;
  let masterVolume = DEFAULT_MASTER_VOLUME;
  let muted = false;
  let destroyed = false;
  let mode: AudioMode | null = null;
  let revealCode: IncubatorRevealCode | null = null;
  let resumeModeOnVisible: ResumeMode | null = null;
  const sequenceTimers = new Set<number>();
  const cleanupTimers = new Set<number>();
  const accessTimers = new Set<number>();
  const activeVolumes = new Map<number, number>();
  const activeLoops = new Map<"idle" | "analysisLoop", number>();
  const lastCueAt = new Map<IncubatorAudioCue, number>();
  const fingerprintPressed = new Set<IncubatorChamber>();
  const fingerprintHoldIds = new Map<IncubatorChamber, number>();
  let fingerprintSyncId: number | null = null;
  let confirmedAnalysisPending = false;
  let accessScanId: number | null = null;
  let accessState: "idle" | "focused" | "scanning" | "granted" = "idle";

  function getHowl() {
    if (!howl && !destroyed) {
      howl = new Howl({
        src: [INCUBATOR_AUDIO_SOURCE],
        format: ["wav"],
        preload: true,
        sprite: INCUBATOR_AUDIO_SPRITE,
        volume: masterVolume,
        mute: muted,
      });
    }
    return howl;
  }

  function isPageHidden() {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  }

  function schedule(callback: () => void, delay: number, cleanup = false) {
    const timerSet = cleanup ? cleanupTimers : sequenceTimers;
    const timer = window.setTimeout(() => {
      timerSet.delete(timer);
      if (!destroyed) callback();
    }, delay);
    timerSet.add(timer);
  }

  function scheduleAccess(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      accessTimers.delete(timer);
      if (!destroyed) callback();
    }, delay);
    accessTimers.add(timer);
  }

  function clearAccessTimers() {
    for (const timer of accessTimers) window.clearTimeout(timer);
    accessTimers.clear();
  }

  function clearSequence() {
    for (const timer of sequenceTimers) window.clearTimeout(timer);
    sequenceTimers.clear();
    analysisId = null;
  }

  function forget(id: number) {
    activeVolumes.delete(id);
    for (const [cue, loopId] of activeLoops) {
      if (loopId === id) activeLoops.delete(cue);
    }
    if (analysisId === id) analysisId = null;
    for (const [chamber, holdId] of fingerprintHoldIds) {
      if (holdId === id) fingerprintHoldIds.delete(chamber);
    }
    if (fingerprintSyncId === id) fingerprintSyncId = null;
    if (accessScanId === id) accessScanId = null;
  }

  function fadeAndStop(id: number, fadeMs: number) {
    const sound = howl;
    if (!sound) return;
    const volume = activeVolumes.get(id) ?? 0;
    sound.fade(volume, 0, fadeMs, id);
    schedule(() => {
      sound.stop(id);
      forget(id);
    }, fadeMs + 10, true);
  }

  function stopFingerprintLayers(fadeMs = FINGERPRINT_RELEASE_FADE_MS) {
    const ids = new Set(fingerprintHoldIds.values());
    if (fingerprintSyncId !== null) ids.add(fingerprintSyncId);
    fingerprintHoldIds.clear();
    fingerprintSyncId = null;
    for (const id of ids) fadeAndStop(id, fadeMs);
  }

  function stopIdleLayer(fadeMs: number) {
    const idleId = activeLoops.get("idle");
    if (idleId === undefined) return;
    activeLoops.delete("idle");
    fadeAndStop(idleId, fadeMs);
  }

  function stopAccessScan(fadeMs = ACCESS_SCAN_FADE_MS) {
    const id = accessScanId;
    accessScanId = null;
    if (id !== null) fadeAndStop(id, fadeMs);
  }

  function ensureIdleLayer() {
    if (
      activeLoops.has("idle") ||
      mode === "analysis" ||
      mode === "reveal" ||
      destroyed ||
      isPageHidden()
    ) return;
    play("idle", IDLE_VOLUME, 1, IDLE_FADE_MS);
  }

  function clearAccessState(fadeMs = 0) {
    clearAccessTimers();
    if (fadeMs > 0) stopAccessScan(fadeMs);
    else accessScanId = null;
    accessState = "idle";
  }

  function clearFingerprintState() {
    fingerprintPressed.clear();
    fingerprintHoldIds.clear();
    fingerprintSyncId = null;
    confirmedAnalysisPending = false;
  }

  function stopAll(fadeMs = 0) {
    clearSequence();
    clearAccessTimers();
    accessScanId = null;
    accessState = "idle";
    fingerprintPressed.clear();
    fingerprintHoldIds.clear();
    fingerprintSyncId = null;
    confirmedAnalysisPending = false;
    const sound = howl;
    if (!sound) return;
    const ids = [...activeVolumes.keys()];
    if (fadeMs > 0) {
      for (const id of ids) {
        const volume = activeVolumes.get(id) ?? 0;
        sound.fade(volume, 0, fadeMs, id);
      }
      schedule(() => {
        for (const id of ids) {
          sound.stop(id);
          forget(id);
        }
      }, fadeMs + 10, true);
      return;
    }
    for (const id of ids) sound.stop(id);
    activeVolumes.clear();
    activeLoops.clear();
  }

  function play(cue: IncubatorAudioCue, volume: number, rate = 1, fadeInMs = 0) {
    if (isPageHidden()) return null;
    const sound = getHowl();
    if (!sound) return null;
    const id = sound.play(cue);
    activeVolumes.set(id, volume);
    if (cue === "idle" || cue === "analysisLoop") activeLoops.set(cue, id);
    sound.volume(fadeInMs > 0 ? 0 : volume, id);
    sound.rate(rate, id);
    if (fadeInMs > 0) sound.fade(0, volume, fadeInMs, id);
    if (cue !== "idle" && cue !== "analysisLoop") {
      sound.once("end", () => forget(id), id);
    }
    return id;
  }

  function playDebounced(cue: IncubatorAudioCue, volume: number) {
    if (isPageHidden()) return;
    const now = Date.now();
    const debounceMs = DUPLICATE_CUE_WINDOW_MS[cue] ?? 0;
    if (now - (lastCueAt.get(cue) ?? -Infinity) < debounceMs) return;
    lastCueAt.set(cue, now);
    play(cue, volume);
  }

  function playSingle(cue: IncubatorAudioCue, volume: number, fadeOutMs = 0) {
    stopAll(fadeOutMs);
    if (fadeOutMs > 0) {
      schedule(() => play(cue, volume), fadeOutMs);
    } else {
      play(cue, volume);
    }
  }

  const api: IncubatorAudioApi = {
    introBoot() {
      if (destroyed || mode === "introBoot") return;
      mode = "introBoot";
      revealCode = null;
      resumeModeOnVisible = isPageHidden() ? "introBoot" : null;
      stopAll(INTRO_TRANSITION_FADE_MS);
      schedule(
        () => play("idle", INTRO_BOOT_VOLUME, 0.82, INTRO_BOOT_FADE_MS),
        INTRO_TRANSITION_FADE_MS,
      );
    },
    introIdentify() {
      if (
        destroyed ||
        mode === "introIdentify" ||
        mode === "introEnter" ||
        mode === "idle"
      ) return;
      mode = "introIdentify";
      resumeModeOnVisible = isPageHidden() ? "introBoot" : null;
      playDebounced("focusLeft", 0.24);
    },
    introEnter() {
      if (destroyed || mode === "introEnter" || mode === "idle") return;
      mode = "introEnter";
      revealCode = null;
      resumeModeOnVisible = isPageHidden() ? "idle" : null;
      stopAll(INTRO_TRANSITION_FADE_MS);
      schedule(() => play("loadSubjects", 0.44), INTRO_TRANSITION_FADE_MS);
      schedule(() => play("startAnalysis", 0.25), INTRO_ENTER_POWER_DELAY_MS);
      schedule(() => {
        mode = "idle";
        resumeModeOnVisible = isPageHidden() ? "idle" : null;
        play("idle", IDLE_VOLUME, 1, INTRO_BOOT_FADE_MS);
      }, INTRO_ENTER_IDLE_DELAY_MS);
    },
    idle() {
      if (mode === "idle" && activeLoops.has("idle")) return;
      mode = "idle";
      revealCode = null;
      resumeModeOnVisible = isPageHidden() ? "idle" : null;
      stopAll(IDLE_FADE_MS);
      schedule(() => play("idle", IDLE_VOLUME, 1, IDLE_FADE_MS), IDLE_FADE_MS);
    },
    focusLeft() {
      playDebounced("focusLeft", 0.3);
    },
    focusRight() {
      playDebounced("focusRight", 0.3);
    },
    fingerprintFocus(chamber) {
      if (destroyed || mode === "analysis" || mode === "reveal") return;
      playDebounced(chamber === "left" ? "focusLeft" : "focusRight", FINGERPRINT_FOCUS_VOLUME);
    },
    fingerprintPress(chamber) {
      if (
        destroyed ||
        isPageHidden() ||
        fingerprintPressed.has(chamber) ||
        mode === "fingerprintSync" ||
        mode === "fingerprintConfirmed" ||
        mode === "analysis" ||
        mode === "reveal"
      ) return;
      fingerprintPressed.add(chamber);
      mode = "fingerprintHold";
      confirmedAnalysisPending = false;
      const rate = chamber === "left" ? 0.74 : 0.79;
      const id = play("analysisLoop", FINGERPRINT_HOLD_VOLUME, rate, FINGERPRINT_HOLD_FADE_MS);
      if (id !== null) fingerprintHoldIds.set(chamber, id);
    },
    fingerprintRelease(chamber) {
      if (destroyed || !fingerprintPressed.has(chamber)) return;
      fingerprintPressed.delete(chamber);
      const holdId = fingerprintHoldIds.get(chamber);
      fingerprintHoldIds.delete(chamber);
      if (holdId !== undefined) fadeAndStop(holdId, FINGERPRINT_RELEASE_FADE_MS);

      if (mode === "fingerprintSync") {
        clearSequence();
        stopFingerprintLayers(FINGERPRINT_RELEASE_FADE_MS);
        mode = "idle";
        resumeModeOnVisible = isPageHidden() ? "idle" : null;
        schedule(
          () => play("idle", IDLE_VOLUME, 1, IDLE_FADE_MS),
          FINGERPRINT_RELEASE_FADE_MS,
        );
      } else if (fingerprintPressed.size === 0 && mode === "fingerprintHold") {
        mode = "idle";
      }
    },
    fingerprintSync() {
      if (
        destroyed ||
        isPageHidden() ||
        mode === "fingerprintSync" ||
        mode === "fingerprintConfirmed" ||
        mode === "analysis" ||
        mode === "reveal"
      ) return;
      mode = "fingerprintSync";
      confirmedAnalysisPending = false;
      clearSequence();
      stopFingerprintLayers(FINGERPRINT_RELEASE_FADE_MS);
      stopIdleLayer(100);
      fingerprintSyncId = play("analysisLoop", 0.1, 0.88, 100);
      const syncId = fingerprintSyncId;
      if (syncId === null) return;
      const sound = getHowl();
      if (!sound) return;
      for (const [atMs, rate, volume] of [
        [450, 0.96, 0.13],
        [900, 1.04, 0.16],
        [1350, 1.12, 0.19],
        [FINGERPRINT_SYNC_DURATION_MS, 1.2, FINGERPRINT_SYNC_VOLUME],
      ] as const) {
        schedule(() => {
          if (fingerprintSyncId !== syncId || mode !== "fingerprintSync") return;
          sound.rate(rate, syncId);
          activeVolumes.set(syncId, volume);
          sound.volume(volume, syncId);
        }, atMs);
      }
    },
    fingerprintConfirmed() {
      if (
        destroyed ||
        mode === "fingerprintConfirmed" ||
        mode === "analysis" ||
        mode === "reveal"
      ) return;
      clearSequence();
      stopFingerprintLayers(60);
      stopIdleLayer(60);
      fingerprintPressed.clear();
      mode = "fingerprintConfirmed";
      confirmedAnalysisPending = true;
      play("chamberLock", 0.42);
    },
    accessTerminalFocus() {
      if (
        destroyed ||
        isPageHidden() ||
        accessState === "focused" ||
        accessState === "scanning" ||
        accessState === "granted"
      ) return;
      accessState = "focused";
      playDebounced("focusLeft", ACCESS_FOCUS_VOLUME);
    },
    accessScanStart() {
      if (
        destroyed ||
        isPageHidden() ||
        accessState === "scanning" ||
        accessState === "granted" ||
        mode === "analysis" ||
        mode === "reveal"
      ) return;
      clearAccessTimers();
      accessState = "scanning";
      accessScanId = play(
        "analysisLoop",
        ACCESS_SCAN_VOLUME,
        ACCESS_SCAN_RATE,
        ACCESS_SCAN_FADE_MS,
      );
    },
    accessScanCancel() {
      if (destroyed || accessState !== "scanning") return;
      accessState = "focused";
      stopAccessScan();
    },
    accessGranted() {
      if (
        destroyed ||
        isPageHidden() ||
        accessState === "granted" ||
        mode === "analysis" ||
        mode === "reveal"
      ) return;
      clearAccessTimers();
      stopAccessScan();
      accessState = "granted";
      play("chamberLock", 0.38);
      scheduleAccess(
        () => play("startAnalysis", 0.2, 0.9),
        ACCESS_GRANTED_ENERGY_DELAY_MS,
      );
      scheduleAccess(ensureIdleLayer, ACCESS_GRANTED_IDLE_DELAY_MS);
    },
    loadSubjects() {
      const finishingIntro =
        mode === null ||
        mode === "introBoot" ||
        mode === "introIdentify" ||
        mode === "introEnter";
      if (finishingIntro) {
        mode = "idle";
        revealCode = null;
        resumeModeOnVisible = isPageHidden() ? "idle" : null;
        stopAll(IDLE_FADE_MS);
        schedule(() => {
          play("loadSubjects", 0.54);
          play("idle", IDLE_VOLUME, 1, IDLE_FADE_MS);
        }, IDLE_FADE_MS);
        return;
      }
      playDebounced("loadSubjects", 0.54);
    },
    startAnalysis() {
      if (mode === "analysis") return;
      const followsFingerprintConfirmation = confirmedAnalysisPending;
      mode = "analysis";
      revealCode = null;
      resumeModeOnVisible = null;
      confirmedAnalysisPending = false;
      if (followsFingerprintConfirmation) {
        clearSequence();
      } else {
        stopAll(80);
        schedule(() => play("startAnalysis", 0.46), 80);
      }

      for (const step of ANALYSIS_AUDIO_CUES) {
        if (followsFingerprintConfirmation && "cue" in step && step.cue === "chamberLock") {
          continue;
        }
        schedule(() => {
          const sound = getHowl();
          if (!sound) return;

          if ("cue" in step) {
            if (step.cue === "analysisLoop") {
              analysisId = play(step.cue, step.volume, 1, 100);
              return;
            }
            if (step.cue === "blackout") {
              if (analysisId !== null) {
                const loopVolume = activeVolumes.get(analysisId) ?? 0;
                sound.fade(loopVolume, 0, 65, analysisId);
                const id = analysisId;
                schedule(() => {
                  sound.stop(id);
                  forget(id);
                }, 70, true);
                analysisId = null;
              }
              play(step.cue, step.volume);
              return;
            }
            play(step.cue, step.volume);
            return;
          }

          if (analysisId !== null) {
            sound.rate(step.rate, analysisId);
            activeVolumes.set(analysisId, step.volume);
            sound.volume(step.volume * masterVolume, analysisId);
          }
        }, step.atMs);
      }
    },
    revealResult(code) {
      if (mode === "reveal" && revealCode === code) return;
      mode = "reveal";
      revealCode = code;
      resumeModeOnVisible = null;
      const cue = code === "0" ? "reveal0" : code === "1" ? "reveal1" : "revealM";
      const volume = code === "0" ? 0.46 : code === "1" ? 0.56 : 0.76;
      stopAll();
      schedule(() => play(cue, volume), REVEAL_PLAY_DELAY_MS[code]);
    },
    reset() {
      if (mode === "reset") return;
      clearFingerprintState();
      clearAccessState();
      mode = "reset";
      revealCode = null;
      resumeModeOnVisible = isPageHidden() ? "idle" : null;
      playSingle("reset", 0.4, 70);
      schedule(() => {
        mode = "idle";
        play("idle", IDLE_VOLUME, 1, IDLE_FADE_MS);
      }, 1270);
    },
    setMasterVolume(volume) {
      masterVolume = Math.max(0, Math.min(1, volume));
      howl?.volume(masterVolume);
    },
    setMuted(value) {
      muted = value;
      howl?.mute(muted);
    },
    getMasterVolume() {
      return masterVolume;
    },
    isMuted() {
      return muted;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearSequence();
      clearAccessTimers();
      for (const timer of cleanupTimers) window.clearTimeout(timer);
      cleanupTimers.clear();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      howl?.stop();
      howl?.off();
      howl?.unload();
      howl = null;
      activeVolumes.clear();
      activeLoops.clear();
      lastCueAt.clear();
      clearFingerprintState();
      accessScanId = null;
      accessState = "idle";
      resumeModeOnVisible = null;
    },
  };

  function handleVisibilityChange() {
    if (destroyed) return;
    if (isPageHidden()) {
      resumeModeOnVisible =
        mode === "introBoot" || mode === "introIdentify"
          ? "introBoot"
          : mode === "idle" ||
              mode === "reset" ||
              mode === "introEnter" ||
              mode === "fingerprintHold" ||
              mode === "fingerprintSync" ||
              mode === "fingerprintConfirmed"
            ? "idle"
            : null;
      clearSequence();
      clearAccessTimers();
      howl?.stop();
      activeVolumes.clear();
      activeLoops.clear();
      clearFingerprintState();
      accessScanId = null;
      accessState = "idle";
      mode = resumeModeOnVisible ?? mode;
      return;
    }
    const resumeMode = resumeModeOnVisible;
    resumeModeOnVisible = null;
    if (resumeMode === "introBoot") {
      mode = "introBoot";
      play("idle", INTRO_BOOT_VOLUME, 0.82, INTRO_BOOT_FADE_MS);
    } else if (resumeMode === "idle") {
      mode = "idle";
      play("idle", IDLE_VOLUME, 1, IDLE_FADE_MS);
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  return api;
}
