import { Howl, type HowlOptions } from "howler";
export {
  createIncubatorAudio,
  destroyIncubatorAudio,
  getIncubatorAudio,
  type IncubatorAudioApi,
} from "./createIncubatorAudio";
export {
  ANALYSIS_AUDIO_CUES,
  INCUBATOR_AUDIO_SOURCE,
  INCUBATOR_AUDIO_SPRITE,
  type IncubatorAudioCue,
} from "./audioSprite";
export {
  createMorueVoice,
  destroyMorueVoice,
  getMorueVoice,
  unlockMorueAudio,
  MORUE_PRELOAD_GROUPS,
  MORUE_VOICE_POLICIES,
  type CreateMorueVoiceOptions,
  type MorueSpeakOptions,
  type MorueVoiceApi,
  type MorueVoiceError,
  type MorueVoiceErrorCode,
  type MorueVoicePreloadGroup,
  type MorueVoiceState,
} from "./createMorueVoice";
export {
  MORUE_VOICE_EVENTS,
  MORUE_VOICE_FILE_NAMES,
  type MorueVoiceAssetLoader,
  type MorueVoiceEvent,
} from "./morueVoiceManifest";

/**
 * Low-level Howler factory retained for consumers that need a custom cue.
 */
export function createIncubatorHowl(options: HowlOptions): Howl {
  return new Howl(options);
}
