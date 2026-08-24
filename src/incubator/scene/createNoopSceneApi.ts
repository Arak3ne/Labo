import type { IncubatorMorueSceneApi } from "./morueSceneApi";

export function createNoopSceneApi(): IncubatorMorueSceneApi {
  return {
    morueInit() {},
    resumeMorueInit() {},
    finishMorueInit() {},
    enterLab(options) {
      options?.onComplete?.();
    },
    introBoot() {},
    introIdentify() {},
    introEnter() {},
    idle() {},
    focusLeft() {},
    focusRight() {},
    fingerprintFocus() {},
    fingerprintPress() {},
    fingerprintRelease() {},
    fingerprintSync() {},
    fingerprintConfirmed() {},
    accessTerminalFocus() {},
    accessScanStart() {},
    accessScanCancel() {},
    accessGranted() {},
    loadSubjects() {},
    startAnalysis() {},
    revealResult() {},
    reset() {},
  };
}
