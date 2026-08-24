import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncubatorRoomSnapshot } from "../types";
import {
  createServerAuthClient,
  createServerFingerprintClient,
  IncubatorTransportError,
} from "./serverFingerprintClient";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function room(
  overrides: Partial<Record<keyof IncubatorRoomSnapshot | "status", unknown>> = {},
): Record<string, unknown> {
  return {
    id: "incubation-1",
    accessCode: "AB-CD",
    initiatorId: "A1",
    participants: [
      { id: "A1", displayName: "Sujet A1", status: "actif" },
      { id: "A2", displayName: "Sujet A2", status: "actif" },
    ],
    chambers: {},
    status: "WAITING",
    createdAt: "2026-08-24T08:00:00.000Z",
    updatedAt: "2026-08-24T08:00:00.000Z",
    expiresAt: "2026-08-24T08:15:00.000Z",
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  push(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  serverClose(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

class FakeVisibility {
  visibilityState = "visible";
  private readonly listeners = new Set<() => void>();

  addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.delete(listener);
  }

  set(state: "visible" | "hidden"): void {
    this.visibilityState = state;
    for (const listener of this.listeners) listener();
  }
}

describe("Incubator browser server transport", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends exact auth bodies with same-origin cookie credentials", async () => {
    const projection = {
      player: { id: "A1", displayName: "Sujet A1", status: "actif" },
      access: { allowed: true, used: 0, remaining: 1 },
    };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(projection))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(projection));
    const auth = createServerAuthClient({ fetch: fetchMock });

    await auth.login("TEST-A1");
    await auth.logout();
    await auth.getMe();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerCode: "TEST-A1" }),
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/me", {
      method: "GET",
      credentials: "include",
    });
  });

  it("uses the access code for create/join and empty mutation bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    for (let index = 0; index < 6; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse(room()));
    }
    const client = createServerFingerprintClient({ fetch: fetchMock });

    await client.createSession("A1-B2");
    await client.joinSession("ZX-42");
    await client.press("left");
    await client.release("left");
    await client.disconnect("right");
    await client.cancel();

    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/incubations",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode: "A1-B2" }),
        credentials: "include",
      },
    ]);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "ZX-42" }),
      credentials: "include",
    });
    for (const call of fetchMock.mock.calls) {
      expect(JSON.stringify(call[1] ?? {})).not.toContain("subjectId");
    }
    expect(fetchMock.mock.calls[2]?.[1]).toEqual({ method: "POST", credentials: "include" });
    expect(fetchMock.mock.calls[3]?.[1]).toEqual({ method: "DELETE", credentials: "include" });
    expect(fetchMock.mock.calls[4]?.[1]).toEqual({ method: "DELETE", credentials: "include" });
    expect(fetchMock.mock.calls[5]?.[1]).toEqual({ method: "DELETE", credentials: "include" });
  });

  it("validates and pushes one public snapshot to two subscribers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () => jsonResponse(room()),
    );
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
      locationHref: "https://labo.test/incubateur",
    });
    await client.createSession("A1-B2");
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = client.subscribe(first);
    const unsubscribeSecond = client.subscribe(second);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]?.url).toBe(
      "wss://labo.test/ws?incubationId=incubation-1",
    );
    FakeWebSocket.instances[0]?.push({
      type: "incubation.snapshot",
      event: "chamber.pressed",
      snapshot: room({
        status: "ONE_FINGERPRINT",
        chambers: { left: { subjectId: "A1", pressed: true } },
      }),
    });

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    expect(first.mock.calls.at(-1)?.[0]).toEqual(second.mock.calls.at(-1)?.[0]);
    expect(client.getSnapshot()).toMatchObject({
      state: "ONE_FINGERPRINT",
      accessCode: "AB-CD",
      chambers: { left: { subjectId: "A1", pressed: true } },
    });

    unsubscribeFirst();
    unsubscribeSecond();
    expect(FakeWebSocket.instances[0]?.readyState).toBe(3);
  });

  it.each([
    {
      participants: [
        { id: "A1", displayName: "Sujet A1", status: "actif" },
        { id: "A1", displayName: "Sujet A1", status: "actif" },
      ],
    },
    {
      participants: [
        { id: "A1", displayName: "Sujet A1", status: "actif" },
        { id: "A2", displayName: "Sujet A2", status: "actif" },
      ],
      chambers: { left: { subjectId: "A3", pressed: false } },
    },
    {
      participants: [
        { id: "A1", displayName: "Sujet A1", status: "actif" },
        { id: "A2", displayName: "Sujet A2", status: "actif" },
      ],
      chambers: {
        left: { subjectId: "A1", pressed: false },
        right: { subjectId: "A1", pressed: false },
      },
    },
  ])("rejects inconsistent participant snapshots", async (overrides) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(room(overrides)));
    const client = createServerFingerprintClient({ fetch: fetchMock });

    await expect(client.createSession("A1-B2")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("reconnects with bounded backoff only while visible and subscribed", async () => {
    vi.useFakeTimers();
    const visibility = new FakeVisibility();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () => jsonResponse(room()),
    );
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
      visibility,
      locationHref: "http://labo.test/",
      reconnectBaseDelayMs: 100,
      maxReconnectAttempts: 2,
    });
    await client.createSession("A1-B2");
    const unsubscribe = client.subscribe(() => undefined);
    FakeWebSocket.instances[0]?.serverClose();
    await flushPromises();

    await vi.advanceTimersByTimeAsync(99);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    visibility.set("hidden");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    visibility.set("visible");
    expect(FakeWebSocket.instances).toHaveLength(3);

    unsubscribe();
    client.destroy();
    FakeWebSocket.instances[2]?.serverClose();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("stops recovery and reports a lost room when the close probe returns 404", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(room()))
      .mockResolvedValueOnce(jsonResponse({ error: "request_denied" }, 404));
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
      reconnectBaseDelayMs: 100,
    });
    await client.createSession("A1-B2");
    const event = vi.fn();
    client.subscribe(() => undefined);
    client.subscribeTransport(event);

    FakeWebSocket.instances[0]?.serverClose();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(event).toHaveBeenCalledWith({
      type: "session_unavailable",
      reason: "unknown_session",
    });
  });

  it("stops recovery when the probe explicitly reports a closed session", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(room()))
      .mockResolvedValueOnce(jsonResponse({ error: "session_closed" }, 409));
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
    });
    await client.createSession("A1-B2");
    const event = vi.fn();
    client.subscribe(() => undefined);
    client.subscribeTransport(event);

    FakeWebSocket.instances[0]?.serverClose();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(event).toHaveBeenCalledWith({
      type: "session_unavailable",
      reason: "session_closed",
    });
  });

  it("probes a surviving room before reconnecting with backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () => jsonResponse(room()),
    );
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
      reconnectBaseDelayMs: 100,
    });
    await client.createSession("A1-B2");
    client.subscribe(() => undefined);

    FakeWebSocket.instances[0]?.serverClose();
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/incubations/incubation-1");
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("does not probe after unsubscribe or destroy", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(room()));
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
    });
    await client.createSession("A1-B2");
    const unsubscribe = client.subscribe(() => undefined);
    const first = FakeWebSocket.instances[0]!;

    unsubscribe();
    first.serverClose();
    client.destroy();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("bounds network probe retries and reports an interrupted connection", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(room()))
      .mockRejectedValue(new Error("offline"));
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
      reconnectBaseDelayMs: 100,
      maxReconnectAttempts: 2,
    });
    await client.createSession("A1-B2");
    const event = vi.fn();
    client.subscribe(() => undefined);
    client.subscribeTransport(event);

    FakeWebSocket.instances[0]?.serverClose();
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(event).toHaveBeenCalledTimes(1);
    expect(event).toHaveBeenCalledWith({
      type: "connection_interrupted",
      reason: "network_error",
    });
  });

  it("keeps HTTP snapshot polling when the websocket cannot stay open", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(room()))
      .mockResolvedValue(jsonResponse(room({
        status: "ONE_FINGERPRINT",
        chambers: { left: { subjectId: "A1", pressed: true } },
      })));
    const client = createServerFingerprintClient({
      fetch: fetchMock,
      WebSocket: FakeWebSocket,
      reconnectBaseDelayMs: 100,
      maxReconnectAttempts: 1,
      pollIntervalMs: 50,
    });
    await client.createSession("A1-B2");
    const listener = vi.fn();
    client.subscribe(listener);
    FakeWebSocket.instances[0]?.serverClose();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(80);

    expect(client.getSnapshot()?.state).toBe("ONE_FINGERPRINT");
    expect(client.getSnapshot()?.chambers).toEqual({
      left: { subjectId: "A1", pressed: true },
    });
    client.destroy();
  });

  it.each([
    [401, "unauthorized"],
    [429, "rate_limited"],
  ] as const)("maps HTTP %s without exposing backend details", async (status, code) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: "sensitive_internal_detail" }, status),
    );
    const auth = createServerAuthClient({ fetch: fetchMock });

    const error = await auth.getMe().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IncubatorTransportError);
    expect(error).toMatchObject({ code, status });
    expect((error as Error).message).not.toContain("sensitive_internal_detail");
  });
});
