import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import type { MorueVoiceApi } from "../audio";
import { IncubatorTransportError } from "../core/serverFingerprintClient";
import type { IncubatorMorueSceneApi } from "../scene";
import type {
  IncubatorChamber,
  IncubatorPersonalProjection,
  IncubatorRoomSnapshot,
  IncubatorServerFingerprintClient,
} from "../types";
import type { IncubatorHistoryEntry, IncubatorUiPhase } from "./incubatorUiTypes";

type ConsoleError =
  | "access_unavailable"
  | "same_identity"
  | "not_authenticated"
  | "access_denied"
  | "access_exhausted"
  | "invalid_state"
  | "unknown_session"
  | "session_closed"
  | "chamber_occupied"
  | "subject_already_present"
  | "unauthorized"
  | "rate_limited"
  | "network_error"
  | "session_interrupted"
  | "request_failed";
type ExtendedSceneApi = IncubatorMorueSceneApi & {
  accessTerminalFocus?(): void;
  accessGranted?(): void;
};
export type IncubatorAccessMode = "initiate" | "join" | null;

interface IncubatorConsoleOptions {
  projection: IncubatorPersonalProjection;
  fingerprintClient: IncubatorServerFingerprintClient;
  voice?: MorueVoiceApi;
  analyzeHoldMs?: number;
  syncDurationMs?: number;
  gracePeriodMs?: number;
  accessCodeDebounceMs?: number;
  accessGrantedDelayMs?: number;
}

const RESULT_VOICE_EVENT = {
  "0": "result_0",
  "1": "result_1",
  M: "result_m",
} as const;

const PUBLIC_AUTHORIZATION_DENIALS = new Set([
  "not_authenticated",
  "unauthorized",
  "access_denied",
  "access_exhausted",
]);

export function mapPublicDenialToVoice(reason: string): "access_denied" | null {
  // No current public denial means "experiment already done". Keep that event
  // available in the voice API until the backend exposes an explicit reason.
  // Protocol stable/unstable are likewise intentionally unbound: the client
  // must wait for a public backend protocol event and never infer the secret.
  return PUBLIC_AUTHORIZATION_DENIALS.has(reason) ? "access_denied" : null;
}

export function useIncubatorConsole(
  sceneRef: Ref<{ api: IncubatorMorueSceneApi | null } | null>,
  options: IncubatorConsoleOptions,
) {
  const client = options.fingerprintClient;
  const voice = options.voice;
  const operator = { id: options.projection.player.id, kind: "joueur" as const };
  const projection = ref(options.projection);
  const history = ref<IncubatorHistoryEntry[]>([]);
  const snapshot = ref<IncubatorRoomSnapshot>();
  const activeChamber = ref<IncubatorChamber | null>(null);
  const localHeldChamber = ref<IncubatorChamber | null>(null);
  const phase = ref<IncubatorUiPhase>("boot");
  const error = ref<ConsoleError | null>(null);
  const lastSceneCommand = ref("idle");
  const lastCode = ref<"0" | "1" | "M" | null>(null);
  const syncDurationMs = options.syncDurationMs ?? 1_800;
  const syncProgress = ref(0);
  const syncRemainingMs = computed(() => {
    if (phase.value !== "syncing") return 0;
    return Math.max(0, Math.round((1 - syncProgress.value) * syncDurationMs));
  });
  const historyOpen = ref(false);
  const sessionLoading = ref(false);
  const accessCode = ref("");
  const accessMode = ref<IncubatorAccessMode>(null);
  const generatedSessionCode = ref<string | null>(null);
  const api = computed(() => sceneRef.value?.api ?? null);
  const introActive = computed(() =>
    ["boot", "identification", "intro_transition"].includes(phase.value),
  );
  const fingerprintState = computed(() => snapshot.value?.state ?? "WAITING");
  const leftOccupant = computed(() => snapshot.value?.chambers.left ?? null);
  const rightOccupant = computed(() => snapshot.value?.chambers.right ?? null);
  const ownChamber = computed<IncubatorChamber | null>(() => {
    if (leftOccupant.value?.subjectId === operator.id) return "left";
    if (rightOccupant.value?.subjectId === operator.id) return "right";
    return null;
  });
  const participantsReady = computed(() => snapshot.value?.participants.length === 2);

  const introTimers = new Set<number>();
  let introStarted = false;
  const introFinished = ref(false);
  const crossingThreshold = computed(() => introFinished.value && introActive.value);
  const airlockReady = ref(false);
  let deferredSceneCommand: (() => void) | null = null;
  let unsubscribeSnapshot: (() => void) | null = null;
  let unsubscribeTransport: (() => void) | null = null;
  let accessTimer: number | null = null;
  let grantedTimer: number | null = null;
  let analysisTimer: number | null = null;
  let syncTimer: number | null = null;
  let revealReady = false;
  let revealPlayed = false;
  let accessGrantedPlayed = false;
  let recordedRunId: string | null = null;
  const biometricRooms = new Set<string>();
  const fingerprintPromptRooms = new Set<string>();
  const waitingRooms = new Set<string>();
  const detectedRooms = new Set<string>();
  const resolvedVoiceRuns = new Set<string>();

  function speakDenial(reason: string) {
    const event = mapPublicDenialToVoice(reason);
    if (!event) return;
    voice?.speak(event, {
      dedupeKey: `authorization:${snapshot.value?.id ?? accessCode.value}`,
      once: true,
    });
  }

  function orchestrate(name: string, action: (scene: ExtendedSceneApi) => void) {
    lastSceneCommand.value = name;
    if (!api.value) {
      deferredSceneCommand = () => {
        if (api.value) action(api.value as ExtendedSceneApi);
      };
      return;
    }
    deferredSceneCommand = null;
    action(api.value as ExtendedSceneApi);
  }

  function releaseIntroHold() {
    const timer = globalThis.setTimeout(() => {
      introTimers.delete(timer);
      api.value?.resumeMorueInit();
    }, 280);
    introTimers.add(timer);
  }

  function speakIntro(event: "morue_init" | "signature_classified", dedupeKey: string) {
    const started = voice?.speak(event, {
      dedupeKey,
      once: true,
      onEnded: releaseIntroHold,
    }) ?? false;
    if (!started) releaseIntroHold();
  }

  function startIntro() {
    if (introStarted) return;
    introStarted = true;
    const reduced = typeof globalThis.matchMedia === "function"
      && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    orchestrate("morueInit", (scene) => {
      scene.morueInit({
        reducedMotion: reduced,
        onAct(act) {
          if (introFinished.value) return;
          if (act === "wake") {
            phase.value = "boot";
            speakIntro("morue_init", "intro-cinematic");
            return;
          }
          if (act === "identify") {
            phase.value = "identification";
            speakIntro("signature_classified", "intro");
            return;
          }
          if (act === "overview") {
            phase.value = "intro_transition";
            airlockReady.value = false;
            scene.resumeMorueInit();
            return;
          }
          if (act === "threshold") {
            airlockReady.value = true;
          }
        },
      });
    });
  }

  function skipIntro() {
    if (!introActive.value || introFinished.value) return;
    introFinished.value = true;
    airlockReady.value = false;
    for (const timer of introTimers) globalThis.clearTimeout(timer);
    introTimers.clear();
    const reduced = typeof globalThis.matchMedia === "function"
      && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    voice?.stop(0);
    voice?.speak("welcome", { dedupeKey: "intro", once: true });
    void voice?.preload("incubation");
    orchestrate("enterLab", (scene) => {
      scene.enterLab({
        reducedMotion: reduced,
        onComplete() {
          phase.value = "inside";
        },
      });
    });
  }

  function mapError(caught: unknown): ConsoleError {
    if (caught instanceof IncubatorTransportError) {
      if (caught.code === "invalid_response") return "request_failed";
      return caught.code;
    }
    return "network_error";
  }

  function handleTransportInterruption() {
    if (!snapshot.value || ["RESOLVED", "CANCELLED"].includes(snapshot.value.state)) return;
    const wasSyncing = snapshot.value.state === "SYNCING";
    if (grantedTimer !== null) globalThis.clearTimeout(grantedTimer);
    if (analysisTimer !== null) globalThis.clearTimeout(analysisTimer);
    if (syncTimer !== null) globalThis.clearInterval(syncTimer);
    grantedTimer = null;
    analysisTimer = null;
    syncTimer = null;
    localHeldChamber.value = null;
    activeChamber.value = null;
    syncProgress.value = 0;
    error.value = "session_interrupted";
    phase.value = "cancelled";
    if (wasSyncing) {
      voice?.speak("synchronization_interrupted", {
        dedupeKey: snapshot.value.id,
        once: true,
      });
    }
  }

  function clearAccessTimer() {
    if (accessTimer !== null) globalThis.clearTimeout(accessTimer);
    accessTimer = null;
  }

  function updateAccessCode(value: string) {
    const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    accessCode.value = compact.length > 2
      ? `${compact.slice(0, 2)}-${compact.slice(2)}`
      : compact;
    error.value = null;
    clearAccessTimer();
    if (
      phase.value !== "access_terminal"
      || !accessMode.value
      || !/^[A-Z][0-9]-[A-Z][0-9]$/.test(accessCode.value)
    ) return;
    accessTimer = globalThis.setTimeout(
      () => void submitAccessCode(),
      options.accessCodeDebounceMs ?? 320,
    );
  }

  async function submitAccessCode() {
    clearAccessTimer();
    if (
      sessionLoading.value
      || phase.value !== "access_terminal"
      || !accessMode.value
      || !/^[A-Z][0-9]-[A-Z][0-9]$/.test(accessCode.value)
    ) return;
    await connect(accessMode.value);
  }

  function openAccessTerminal() {
    if (phase.value !== "inside") return;
    phase.value = "access_terminal";
    orchestrate("accessTerminalFocus", (scene) => scene.accessTerminalFocus?.());
  }

  function selectAccessMode(mode: Exclude<IncubatorAccessMode, null>) {
    if (sessionLoading.value || phase.value !== "access_terminal") return;
    clearAccessTimer();
    accessMode.value = mode;
    accessCode.value = "";
    error.value = null;
  }

  function updateProjectionCounter() {
    void client.getAccessCounter().then((counter) => {
      projection.value = {
        ...projection.value,
        access: {
          allowed: counter.remaining > 0,
          used: counter.used,
          remaining: counter.remaining,
        },
      };
    }).catch(() => undefined);
  }

  async function connect(mode: Exclude<IncubatorAccessMode, null>) {
    sessionLoading.value = true;
    error.value = null;
    unsubscribeSnapshot?.();
    try {
      const result = mode === "initiate"
        ? await client.createSession(accessCode.value)
        : await client.joinSession(accessCode.value);
      if (!result.ok) {
        error.value = "access_unavailable";
        speakDenial(result.reason);
        return;
      }
      if (
        mode === "join"
        && result.snapshot.participants.length === 1
        && result.snapshot.participants[0]?.id === operator.id
      ) {
        error.value = "same_identity";
        return;
      }
      generatedSessionCode.value = result.snapshot.accessCode;
      unsubscribeSnapshot = client.subscribe(applySnapshot);
      applySnapshot(result.snapshot);
      updateProjectionCounter();
    } catch (caught) {
      error.value = mapError(caught);
      speakDenial(error.value);
    } finally {
      sessionLoading.value = false;
    }
  }

  function grantChambers() {
    if (accessGrantedPlayed) return;
    accessGrantedPlayed = true;
    phase.value = "access_granted";
    orchestrate("accessGranted", (scene) => scene.accessGranted?.());
    voice?.speak("incubator_ready", {
      dedupeKey: snapshot.value?.id ?? "room",
      once: true,
    });
    grantedTimer = globalThis.setTimeout(() => {
      grantedTimer = null;
      if (!snapshot.value || snapshot.value.participants.length !== 2) return;
      phase.value = snapshot.value.state === "ONE_FINGERPRINT" ? "one_fingerprint" : "waiting";
      orchestrate("loadSubjects", (scene) => scene.loadSubjects());
      const roomId = snapshot.value.id;
      if (!biometricRooms.has(roomId)) {
        biometricRooms.add(roomId);
        voice?.speak("biometric_required", { dedupeKey: roomId, once: true });
      }
    }, options.accessGrantedDelayMs ?? 480);
  }

  function startSyncProgress() {
    if (syncTimer !== null) globalThis.clearInterval(syncTimer);
    const started = Date.now();
    syncProgress.value = 0.01;
    syncTimer = globalThis.setInterval(() => {
      syncProgress.value = Math.min(1, (Date.now() - started) / syncDurationMs);
    }, 40);
  }

  function revealWhenReady() {
    const current = snapshot.value;
    if (!revealReady || revealPlayed || current?.state !== "RESOLVED" || !current.result) return;
    revealPlayed = true;
    lastCode.value = current.result;
    phase.value = "reveal";
    orchestrate("revealResult", (scene) => scene.revealResult(current.result!));
    if (current.runId && recordedRunId !== current.runId) {
      const left = current.chambers.left?.subjectId;
      const right = current.chambers.right?.subjectId;
      if (left && right) {
        recordedRunId = current.runId;
        history.value.unshift({
          id: current.runId,
          subjectIds: [left, right],
          code: current.result,
          at: current.updatedAt,
          actor: operator,
          consentId: `fingerprint-session:${current.id}`,
        });
      }
    }
  }

  function applySnapshot(next: IncubatorRoomSnapshot) {
    const previousSnapshot = snapshot.value;
    const previous = previousSnapshot?.state;
    const previousParticipantCount = previousSnapshot?.participants.length ?? 0;
    snapshot.value = next;
    error.value = null;
    generatedSessionCode.value = next.accessCode;
    if (next.participants.length === 1 && !waitingRooms.has(next.id)) {
      waitingRooms.add(next.id);
      voice?.speak("waiting_second_subject", { dedupeKey: next.id, once: true });
    }
    if (
      previousParticipantCount === 1
      && next.participants.length === 2
      && !detectedRooms.has(next.id)
    ) {
      detectedRooms.add(next.id);
      voice?.speak("second_subject_detected", { dedupeKey: next.id, once: true });
    }
    if (next.participants.length !== 2 && !["ANALYZING", "RESOLVED"].includes(next.state)) {
      accessGrantedPlayed = false;
      if (grantedTimer !== null) globalThis.clearTimeout(grantedTimer);
      grantedTimer = null;
      activeChamber.value = null;
      phase.value = "waiting_participant";
      return;
    }
    if (!accessGrantedPlayed) {
      grantChambers();
      return;
    }
    if (phase.value === "access_granted" && grantedTimer !== null) return;
    if (next.state === "SYNCING") {
      phase.value = "syncing";
      if (previous !== "SYNCING") {
        startSyncProgress();
        orchestrate("fingerprintSync", (scene) => scene.fingerprintSync());
        voice?.speak("synchronization", { dedupeKey: next.id, once: true });
      }
      return;
    }
    if (previous === "SYNCING" && syncTimer !== null) {
      globalThis.clearInterval(syncTimer);
      syncTimer = null;
      syncProgress.value = 0;
    }
    if (
      previous === "SYNCING"
      && ["WAITING", "ONE_FINGERPRINT", "CANCELLED"].includes(next.state)
    ) {
      voice?.speak("synchronization_interrupted", {
        dedupeKey: next.id,
        once: true,
      });
    }
    if (next.state === "ANALYZING") {
      if (phase.value !== "analyze") {
        phase.value = "analyze";
        if (!localHeldChamber.value) activeChamber.value = null;
        orchestrate("fingerprintConfirmed", (scene) => scene.fingerprintConfirmed());
        orchestrate("startAnalysis", (scene) => scene.startAnalysis());
        void voice?.preload("results");
        voice?.speak("analysis", { dedupeKey: next.id, once: true });
        analysisTimer = globalThis.setTimeout(() => {
          revealReady = true;
          revealWhenReady();
        }, options.analyzeHoldMs ?? 8200);
      }
      return;
    }
    if (next.state === "RESOLVED") {
      if (next.result) {
        const runKey = next.runId ?? next.id;
        if (!resolvedVoiceRuns.has(runKey)) {
          resolvedVoiceRuns.add(runKey);
          voice?.speak(RESULT_VOICE_EVENT[next.result], {
            dedupeKey: runKey,
            once: true,
          });
        }
      }
      revealWhenReady();
      return;
    }
    if (next.state === "CANCELLED") {
      phase.value = "cancelled";
      return;
    }
    phase.value = next.state === "ONE_FINGERPRINT" ? "one_fingerprint" : "waiting";
  }

  function openChamber(side: IncubatorChamber) {
    if (!participantsReady.value || !["waiting", "one_fingerprint", "syncing"].includes(phase.value)) return;
    const occupant = snapshot.value?.chambers[side];
    if ((occupant && occupant.subjectId !== operator.id) || (ownChamber.value && ownChamber.value !== side)) return;
    activeChamber.value = side;
    orchestrate("fingerprintFocus", (scene) => scene.fingerprintFocus(side));
    const roomId = snapshot.value?.id;
    if (roomId && !fingerprintPromptRooms.has(roomId)) {
      fingerprintPromptRooms.add(roomId);
      voice?.speak("fingerprints", { dedupeKey: roomId, once: true });
    }
  }

  async function pressFingerprint(side: IncubatorChamber) {
    if (!participantsReady.value || localHeldChamber.value) return;
    localHeldChamber.value = side;
    orchestrate("fingerprintPress", (scene) => scene.fingerprintPress(side));
    try {
      const result = await client.press(side);
      if (result.ok) applySnapshot(result.snapshot);
      else {
        error.value = result.reason;
        speakDenial(result.reason);
      }
    } catch (caught) {
      error.value = mapError(caught);
    }
  }

  async function stopFingerprint(mode: "release" | "disconnect" = "release") {
    const side = localHeldChamber.value;
    if (!side) return;
    localHeldChamber.value = null;
    if (phase.value === "analyze") activeChamber.value = null;
    orchestrate("fingerprintRelease", (scene) => scene.fingerprintRelease(side));
    try {
      const result = await client[mode](side);
      if (result.ok) applySnapshot(result.snapshot);
      else if (result.reason !== "session_closed") {
        error.value = result.reason;
        speakDenial(result.reason);
      }
    } catch (caught) {
      error.value = mapError(caught);
    }
  }

  function closeContext() {
    if (historyOpen.value) historyOpen.value = false;
    else activeChamber.value = null;
  }

  function resetConsole() {
    clearAccessTimer();
    unsubscribeSnapshot?.();
    unsubscribeSnapshot = null;
    snapshot.value = undefined;
    generatedSessionCode.value = null;
    accessCode.value = "";
    accessMode.value = null;
    error.value = null;
    activeChamber.value = null;
    lastCode.value = null;
    revealReady = false;
    revealPlayed = false;
    accessGrantedPlayed = false;
    phase.value = "access_terminal";
    orchestrate("reset", (scene) => scene.reset());
    orchestrate("accessTerminalFocus", (scene) => scene.accessTerminalFocus?.());
  }

  function handleEscape() {
    if (phase.value === "access_terminal" && accessMode.value) {
      if (sessionLoading.value) return;
      clearAccessTimer();
      accessMode.value = null;
      accessCode.value = "";
      error.value = null;
    } else if (phase.value === "reveal" || phase.value === "cancelled") resetConsole();
    else closeContext();
  }

  watch(api, () => {
    const command = deferredSceneCommand;
    deferredSceneCommand = null;
    command?.();
  });
  unsubscribeTransport = client.subscribeTransport(handleTransportInterruption);
  startIntro();

  onScopeDispose(() => {
    for (const timer of introTimers) globalThis.clearTimeout(timer);
    clearAccessTimer();
    if (grantedTimer !== null) globalThis.clearTimeout(grantedTimer);
    if (analysisTimer !== null) globalThis.clearTimeout(analysisTimer);
    if (syncTimer !== null) globalThis.clearInterval(syncTimer);
    unsubscribeSnapshot?.();
    unsubscribeTransport?.();
    const held = localHeldChamber.value;
    if (held) void client.disconnect(held);
    client.destroy();
  });

  return {
    operator,
    projection,
    history,
    snapshot,
    activeChamber,
    localHeldChamber,
    ownChamber,
    phase,
    error,
    lastCode,
    syncProgress,
    syncRemainingMs,
    historyOpen,
    sessionLoading,
    accessCode,
    accessMode,
    generatedSessionCode,
    introActive,
    crossingThreshold,
    airlockReady,
    fingerprintState,
    lastSceneCommand,
    api,
    openChamber,
    pressFingerprint,
    stopFingerprint,
    closeContext,
    openHistory: () => { historyOpen.value = true; },
    handleEscape,
    resetConsole,
    startIntro,
    skipIntro,
    openAccessTerminal,
    updateAccessCode,
    submitAccessCode,
    selectAccessMode,
    clearAccessMode: () => {
      clearAccessTimer();
      accessMode.value = null;
      accessCode.value = "";
      error.value = null;
    },
  };
}
