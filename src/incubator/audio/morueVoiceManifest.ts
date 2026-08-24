export const MORUE_VOICE_EVENTS = [
  "morue_init",
  "identification",
  "access_granted",
  "welcome",
  "signature_classified",
  "waiting_second_subject",
  "second_subject_detected",
  "biometric_required",
  "fingerprints",
  "synchronization",
  "analysis",
  "result_0",
  "result_1",
  "result_m",
  "access_denied",
  "experiment_already_done",
  "synchronization_interrupted",
  "protocol_unstable",
  "protocol_stable",
  "incubator_ready",
] as const;

export type MorueVoiceEvent = (typeof MORUE_VOICE_EVENTS)[number];
export type MorueVoiceAssetLoader = () => Promise<string>;

export const MORUE_VOICE_FILE_NAMES: Readonly<Record<MorueVoiceEvent, string>> = {
  morue_init: "system_init",
  identification: "identification",
  access_granted: "access_granted",
  welcome: "welcome",
  signature_classified: "signature classified",
  waiting_second_subject: "second_subjet_wait",
  second_subject_detected: "second_subject_connected",
  biometric_required: "biometric required",
  fingerprints: "fingerprints",
  synchronization: "syncrhonization",
  analysis: "analisys",
  result_0: "result_0",
  result_1: "result_1",
  result_m: "result_M",
  access_denied: "access_denied",
  experiment_already_done: "experiment_already_done",
  synchronization_interrupted: "synchronization_interrupted",
  protocol_unstable: "protocol_unstable",
  protocol_stable: "protocol_stable",
  incubator_ready: "incubator_ready",
};

const discoveredAssets = import.meta.glob<string>(
  "./M.O.R.U.E/*.{mp3,wav,ogg,m4a}",
  {
    query: "?url",
    import: "default",
  },
);

function fileStem(path: string): string {
  const fileName = path.split("/").at(-1) ?? "";
  return fileName.slice(0, fileName.lastIndexOf("."));
}

export function discoverMorueVoiceAssets(): Partial<
  Record<MorueVoiceEvent, MorueVoiceAssetLoader>
> {
  const byStem = new Map(
    Object.entries(discoveredAssets).map(([path, loader]) => [fileStem(path), loader]),
  );

  return Object.fromEntries(
    MORUE_VOICE_EVENTS.flatMap((event) => {
      const loader = byStem.get(MORUE_VOICE_FILE_NAMES[event]);
      return loader ? [[event, loader]] : [];
    }),
  );
}
