import type { IncubatorSceneApi } from "../types";

export function createNoopSceneApi(): IncubatorSceneApi {
  return {
    idle() {},
    focusLeft() {},
    focusRight() {},
    loadSubjects() {},
    startAnalysis() {},
    revealResult() {},
    reset() {},
  };
}
