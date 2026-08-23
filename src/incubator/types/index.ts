/**
 * Shared incubator contracts.
 * Domain rules belong in `incubator/core` (server-backed).
 * Secret DNA must never be stored or computed on the client.
 */

export type IncubatorModuleId = "core" | "ui" | "scene" | "audio";

export type IncubatorRevealCode = "0" | "1" | "M";

export type IncubatorSubjectId = string;

export interface IncubatorSubjectPreview {
  id: IncubatorSubjectId;
}

export interface IncubatorSceneApi {
  idle(): void;
  focusLeft(): void;
  focusRight(): void;
  loadSubjects(): void;
  startAnalysis(): void;
  revealResult(code: IncubatorRevealCode): void;
  reset(): void;
}

export type IncubatorRuntimeFlag = "scene" | "gsap" | "audio" | "rive";
