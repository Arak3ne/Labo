import type { IncubatorSceneApi } from "../types";

export type MorueInitAct = "wake" | "identify" | "overview" | "threshold";

export interface MorueInitOptions {
  reducedMotion?: boolean;
  onAct?: (act: MorueInitAct) => void;
}

export interface MorueEnterLabOptions {
  reducedMotion?: boolean;
  onComplete?: () => void;
}

declare module "../types" {
  interface IncubatorSceneApi {
    morueInit(options?: MorueInitOptions): void;
    resumeMorueInit(): void;
    finishMorueInit(): void;
    enterLab(options?: MorueEnterLabOptions): void;
  }
}

export type IncubatorMorueSceneApi = IncubatorSceneApi;
