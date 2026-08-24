import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { MorueVoiceApi } from "../audio";
import type { IncubatorAuthClient, IncubatorPersonalProjection } from "../types";
import { createIncubatorAuthController } from "./incubatorAuth";

const authGateSource = readFileSync(new URL("./IncubatorAuthGate.vue", import.meta.url), "utf8");

const projection: IncubatorPersonalProjection = {
  player: { id: "A1", displayName: "SUJET A1", status: "actif" },
  access: { allowed: true, used: 0, remaining: 1 },
};

function client(): IncubatorAuthClient {
  return {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(async () => undefined),
  };
}

function voice(): MorueVoiceApi {
  return {
    speak: vi.fn((_event, options) => {
      queueMicrotask(() => options?.onEnded?.());
      return true;
    }),
    stop: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: vi.fn(() => false),
    preload: vi.fn(async () => undefined),
    getState: vi.fn(() => ({ status: "idle" })),
    destroy: vi.fn(),
  };
}

describe("Incubator auth controller", () => {
  it("preloads MORUE without speaking before the scene starts", () => {
    const morue = voice();
    createIncubatorAuthController(client(), () => undefined, morue);

    expect(morue.preload).toHaveBeenCalledWith("intro");
    expect(morue.speak).not.toHaveBeenCalled();
  });

  it("turns an initial 401 into the login state", async () => {
    const authClient = client();
    vi.mocked(authClient.getMe).mockRejectedValue({ code: "unauthorized" });
    const auth = createIncubatorAuthController(authClient, (error) =>
      (error as { code?: string }).code,
    );

    await auth.check();
    expect(auth.status.value).toBe("anonymous");
    expect(auth.projection.value).toBeUndefined();
  });

  it("keeps only the personal projection after a successful login", async () => {
    const authClient = client();
    const morue = voice();
    vi.mocked(authClient.login).mockResolvedValue(projection);
    const auth = createIncubatorAuthController(
      authClient,
      (error) => (error as { code?: string }).code,
      morue,
    );

    await expect(auth.login("A1")).resolves.toBe(true);
    expect(authClient.login).toHaveBeenCalledWith("A1");
    expect(auth.status.value).toBe("authenticated");
    expect(auth.projection.value).toEqual(projection);
    expect(vi.mocked(morue.speak).mock.calls.map(([event]) => event)).toEqual([
      "identification",
      "access_granted",
    ]);
  });

  it("does not open the lab until identification and access_granted have finished", async () => {
    const authClient = client();
    const morue = voice();
    vi.mocked(morue.speak).mockImplementation(() => true);
    vi.mocked(authClient.login).mockResolvedValue(projection);
    const auth = createIncubatorAuthController(
      authClient,
      (error) => (error as { code?: string }).code,
      morue,
    );

    const pending = auth.login("A1");
    await Promise.resolve();
    expect(auth.status.value).not.toBe("authenticated");
    expect(vi.mocked(morue.speak).mock.calls.map(([event]) => event)).toEqual(["identification"]);

    vi.mocked(morue.speak).mock.calls[0]?.[1]?.onEnded?.();
    await Promise.resolve();
    expect(auth.status.value).not.toBe("authenticated");
    expect(vi.mocked(morue.speak).mock.calls.map(([event]) => event)).toEqual([
      "identification",
      "access_granted",
    ]);

    vi.mocked(morue.speak).mock.calls[1]?.[1]?.onEnded?.();
    await expect(pending).resolves.toBe(true);
    expect(auth.status.value).toBe("authenticated");
  });

  it.each([
    ["unauthorized", "invalid_credentials"],
    ["rate_limited", "rate_limited"],
    ["network_error", "unavailable"],
  ])("maps %s without exposing server details", async (code, expected) => {
    const authClient = client();
    const morue = voice();
    vi.mocked(authClient.login).mockRejectedValue({ code, detail: "private" });
    const auth = createIncubatorAuthController(
      authClient,
      (error) => (error as { code?: string }).code,
      morue,
    );

    await auth.login("A1");
    expect(auth.error.value).toBe(expected);
    expect(JSON.stringify(auth.error.value)).not.toContain("private");
    expect(vi.mocked(morue.speak).mock.calls.map(([event]) => event)).toEqual(
      code === "unauthorized"
        ? ["identification", "access_denied"]
        : ["identification"],
    );
  });

  it("renders only a player-code credential without an identity picker", () => {
    expect(authGateSource).toContain("CODE JOUEUR");
    expect(authGateSource).toContain(".trim().toUpperCase()");
    expect(authGateSource).not.toMatch(/password|current-password/i);
    expect(authGateSource).not.toMatch(/<(?:select|option)\b|role=["'](?:listbox|option|radiogroup)["']/i);
  });
});
