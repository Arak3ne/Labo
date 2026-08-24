import { Vector2 } from "three";
import type { InjectionKey } from "vue";
import { inject, reactive } from "vue";
import type { IncubatorRevealCode } from "../types";

export type IncubatorScenePhase =
  | "morueInit"
  | "introBoot"
  | "introIdentify"
  | "introEnter"
  | "accessTerminal"
  | "accessScan"
  | "accessGranted"
  | "idle"
  | "focusLeft"
  | "focusRight"
  | "fingerprint"
  | "fingerprintSync"
  | "fingerprintConfirmed"
  | "loadSubjects"
  | "analyze"
  | "reveal";

export interface IncubatorVisualState {
  phase: IncubatorScenePhase;
  revealCode: IncubatorRevealCode | null;
  subjectPresence: number;
  leftEmphasis: number;
  rightEmphasis: number;
  analysis: number;
  ringVelocity: number;
  coreEnergy: number;
  revealPower: number;
  scanOffset: number;
  scanVisible: number;
  glyphOpacity: number;
  tintR: number;
  tintG: number;
  tintB: number;
  keyIntensity: number;
  lockAmount: number;
  hatchOpen: number;
  innerGlow: number;
  vapor: number;
  flicker: number;
  residualScan: number;
  energyFlow: number;
  blackout: number;
  glitch: number;
  bloom: number;
  chroma: number;
  idleDrift: number;
  pulse: number;
  leftFingerprint: number;
  rightFingerprint: number;
  leftFingerprintScan: number;
  rightFingerprintScan: number;
  leftFingerprintEnergy: number;
  rightFingerprintEnergy: number;
  fingerprintSync: number;
  accessTerminal: number;
  accessScan: number;
  accessUnlock: number;
  moruePresence: number;
  diagnosticScan: number;
  airlockPresence: number;
  airlockOpen: number;
  labPresence: number;
}

export interface IncubatorPostFx {
  bloom: number;
  chroma: number;
  glitch: number;
  vignette: number;
}

export const incubatorVisualKey: InjectionKey<IncubatorVisualState> = Symbol("incubator-visual");

export const incubatorPostFx: IncubatorPostFx = reactive({
  bloom: 0.38,
  chroma: 0,
  glitch: 0,
  vignette: 0.9,
});

export const incubatorChromaOffset = new Vector2(0, 0);

export function createIdleVisualState(): IncubatorVisualState {
  return {
    phase: "idle",
    revealCode: null,
    subjectPresence: 0,
    leftEmphasis: 0,
    rightEmphasis: 0,
    analysis: 0,
    ringVelocity: 0.12,
    coreEnergy: 0.34,
    revealPower: 0,
    scanOffset: 0,
    scanVisible: 0,
    glyphOpacity: 0,
    tintR: 0.0588,
    tintG: 0.7098,
    tintB: 0.4627,
    keyIntensity: 0.18,
    lockAmount: 0,
    hatchOpen: 0.84,
    innerGlow: 0.09,
    vapor: 0.1,
    flicker: 0,
    residualScan: 0,
    energyFlow: 0,
    blackout: 0,
    glitch: 0,
    bloom: 0.38,
    chroma: 0,
    idleDrift: 1,
    pulse: 0.35,
    leftFingerprint: 0,
    rightFingerprint: 0,
    leftFingerprintScan: 0,
    rightFingerprintScan: 0,
    leftFingerprintEnergy: 0,
    rightFingerprintEnergy: 0,
    fingerprintSync: 0,
    accessTerminal: 0,
    accessScan: 0,
    accessUnlock: 0,
    moruePresence: 0,
    diagnosticScan: 0,
    airlockPresence: 0,
    airlockOpen: 0,
    labPresence: 1,
  };
}

export function useIncubatorVisual(): IncubatorVisualState {
  const state = inject(incubatorVisualKey);
  if (!state) {
    throw new Error("Incubator visual state is missing");
  }
  return state;
}

export function revealTint(code: IncubatorRevealCode): { r: number; g: number; b: number } {
  if (code === "0") {
    return { r: 0.0196, g: 0.3765, b: 0.2353 };
  }
  if (code === "1") {
    return { r: 0.5412, g: 0.749, b: 0.651 };
  }
  return { r: 0.9961, g: 0.9961, b: 0.9961 };
}

export function restTint(): { r: number; g: number; b: number } {
  return { r: 0.0588, g: 0.7098, b: 0.4627 };
}

export function syncPostFx(visual: IncubatorVisualState) {
  incubatorPostFx.bloom = visual.bloom * (1 - visual.blackout * 0.92);
  incubatorPostFx.chroma = visual.chroma;
  incubatorPostFx.glitch = visual.glitch >= 0.7 ? visual.glitch : 0;
  incubatorPostFx.vignette = 0.86 + visual.blackout * 0.14 + visual.analysis * 0.06;
  incubatorChromaOffset.set(visual.chroma * 0.0022, visual.chroma * 0.0014);
}
