import { Rive, type RiveParameters } from "@rive-app/canvas";

/**
 * Official canvas runtime. No Vue wrapper exists; UI agents can mount this on a canvas.
 */
export function createIncubatorRive(params: RiveParameters): Rive {
  return new Rive(params);
}
