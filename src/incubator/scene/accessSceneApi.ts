import type { IncubatorSceneApi } from "../types";

declare module "../types" {
  interface IncubatorSceneApi {
    accessTerminalFocus(): void;
    accessScanStart(): void;
    accessScanCancel(): void;
    accessGranted(): void;
  }
}

export type IncubatorAccessSceneApi = IncubatorSceneApi;
