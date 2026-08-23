import { Howl, type HowlOptions } from "howler";

/**
 * Howler factory for later incubator cues. Bootstrap does not load assets or play audio.
 */
export function createIncubatorHowl(options: HowlOptions): Howl {
  return new Howl(options);
}
