import { inject, ref, type InjectionKey, type Ref } from "vue";
import type { MorueSpeakOptions, MorueVoiceApi, MorueVoiceEvent } from "../audio";
import type { IncubatorAuthClient, IncubatorPersonalProjection } from "../types";

const VOICE_LINE_TIMEOUT_MS = 20_000;

function speakUntilEnded(
  voice: MorueVoiceApi | undefined,
  event: MorueVoiceEvent,
  options: MorueSpeakOptions = {},
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(safety);
      resolve();
    };
    const safety = globalThis.setTimeout(finish, VOICE_LINE_TIMEOUT_MS);
    const started = voice?.speak(event, {
      ...options,
      onEnded: finish,
    }) ?? false;
    if (!started) finish();
  });
}

export interface IncubatorAuthContext {
  projection: Readonly<Ref<IncubatorPersonalProjection>>;
  logout(): Promise<void>;
}

export const incubatorAuthKey: InjectionKey<IncubatorAuthContext> = Symbol("incubator-auth");

export function useIncubatorAuth(): IncubatorAuthContext {
  const context = inject(incubatorAuthKey);
  if (!context) throw new Error("Incubator auth context is unavailable");
  return context;
}

export interface IncubatorAuthController {
  status: Ref<"checking" | "anonymous" | "authenticated" | "unavailable">;
  projection: Ref<IncubatorPersonalProjection | undefined>;
  error: Ref<"invalid_credentials" | "rate_limited" | "unavailable" | null>;
  check(): Promise<void>;
  login(playerCode: string): Promise<boolean>;
  logout(): Promise<void>;
}

export function createIncubatorAuthController(
  client: IncubatorAuthClient,
  transportCode: (error: unknown) => string | undefined,
  voice?: MorueVoiceApi,
): IncubatorAuthController {
  const status = ref<"checking" | "anonymous" | "authenticated" | "unavailable">("checking");
  const projection = ref<IncubatorPersonalProjection>();
  const error = ref<"invalid_credentials" | "rate_limited" | "unavailable" | null>(null);
  let loginAttempt = 0;

  void voice?.preload("intro");

  async function check() {
    status.value = "checking";
    error.value = null;
    try {
      projection.value = await client.getMe();
      status.value = "authenticated";
    } catch (caught) {
      projection.value = undefined;
      if (transportCode(caught) === "unauthorized") {
        status.value = "anonymous";
      } else {
        status.value = "unavailable";
        error.value = "unavailable";
      }
    }
  }

  async function login(playerCode: string) {
    const attemptKey = `login-attempt-${++loginAttempt}`;
    error.value = null;
    const identified = speakUntilEnded(voice, "identification", {
      dedupeKey: attemptKey,
      once: true,
    });
    try {
      projection.value = await client.login(playerCode);
      await identified;
      await speakUntilEnded(voice, "access_granted", {
        dedupeKey: attemptKey,
        once: true,
      });
      status.value = "authenticated";
      return true;
    } catch (caught) {
      const code = transportCode(caught);
      error.value = code === "rate_limited"
        ? "rate_limited"
        : code === "unauthorized"
          ? "invalid_credentials"
          : "unavailable";
      if (code === "unauthorized") {
        voice?.speak("access_denied", { dedupeKey: attemptKey, once: true });
      }
      return false;
    }
  }

  async function logout() {
    try {
      await client.logout();
    } finally {
      projection.value = undefined;
      status.value = "anonymous";
    }
  }

  return { status, projection, error, check, login, logout };
}
