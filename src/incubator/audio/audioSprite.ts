import type { HowlOptions } from "howler";

export type IncubatorAudioCue =
  | "idle"
  | "focusLeft"
  | "focusRight"
  | "loadSubjects"
  | "chamberLock"
  | "scan"
  | "startAnalysis"
  | "analysisLoop"
  | "blackout"
  | "reveal0"
  | "reveal1"
  | "revealM"
  | "reset";

export const INCUBATOR_AUDIO_SOURCE = "/incubator/audio/incubator-sprite.wav";

export const INCUBATOR_AUDIO_SPRITE: NonNullable<HowlOptions["sprite"]> = {
  idle: [0, 8000, true],
  focusLeft: [8080, 320],
  focusRight: [8480, 320],
  loadSubjects: [8880, 1650],
  chamberLock: [10610, 950],
  scan: [11640, 1500],
  startAnalysis: [13220, 1150],
  analysisLoop: [14450, 4000, true],
  blackout: [18530, 220],
  reveal0: [18830, 800],
  reveal1: [19710, 1100],
  revealM: [20890, 2800],
  reset: [23770, 1200],
};

export const ANALYSIS_AUDIO_CUES = [
  { atMs: 180, cue: "chamberLock" as const, volume: 0.68 },
  { atMs: 950, cue: "scan" as const, volume: 0.42 },
  { atMs: 2200, cue: "analysisLoop" as const, volume: 0.22 },
  { atMs: 3000, cue: "scan" as const, volume: 0.26 },
  { atMs: 3600, rate: 1.06, volume: 0.27 },
  { atMs: 4400, rate: 1.13, volume: 0.33 },
  { atMs: 5400, rate: 1.21, volume: 0.4 },
  { atMs: 6400, rate: 1.31, volume: 0.47 },
  { atMs: 7250, rate: 1.38, volume: 0.52 },
  { atMs: 7550, cue: "blackout" as const, volume: 0.62 },
] as const;
