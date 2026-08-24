import type {
  IncubatorAccessCounter,
  IncubatorAuthClient,
  IncubatorChamber,
  IncubatorFingerprintDenialReason,
  IncubatorFingerprintResult,
  IncubatorFingerprintState,
  IncubatorFingerprintTransportEvent,
  IncubatorPersonalProjection,
  IncubatorPlayerPublic,
  IncubatorRevealCode,
  IncubatorRoomSnapshot,
  IncubatorServerFingerprintClient,
  IncubatorTransportErrorCode,
} from "../types";

const FINGERPRINT_STATES = new Set<IncubatorFingerprintState>([
  "WAITING",
  "ONE_FINGERPRINT",
  "SYNCING",
  "ANALYZING",
  "RESOLVED",
  "CANCELLED",
]);
const TERMINAL_STATES = new Set<IncubatorFingerprintState>(["RESOLVED", "CANCELLED"]);
const CHAMBERS = new Set<IncubatorChamber>(["left", "right"]);
const REVEAL_CODES = new Set<IncubatorRevealCode>(["0", "1", "M"]);

interface WebSocketPort {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close(code?: number, reason?: string): void;
}

interface WebSocketConstructor {
  new (url: string | URL): unknown;
}

interface VisibilityPort {
  readonly visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface IncubatorBrowserTransportOptions {
  fetch?: typeof fetch;
  WebSocket?: WebSocketConstructor;
  visibility?: VisibilityPort;
  locationHref?: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
}

export class IncubatorTransportError extends Error {
  readonly code: IncubatorTransportErrorCode;
  readonly status?: number;

  constructor(code: IncubatorTransportErrorCode, status?: number) {
    super(code);
    this.name = "IncubatorTransportError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function mapPlayer(value: unknown): IncubatorPlayerPublic {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.displayName !== "string"
    || (value.status !== "actif" && value.status !== "archivé")
  ) {
    throw new IncubatorTransportError("invalid_response");
  }
  return {
    id: value.id,
    displayName: value.displayName,
    status: value.status,
  };
}

function mapPersonalProjection(value: unknown): IncubatorPersonalProjection {
  if (
    !isRecord(value)
    || !isRecord(value.access)
    || typeof value.access.allowed !== "boolean"
    || !isNonNegativeInteger(value.access.used)
    || !isNonNegativeInteger(value.access.remaining)
  ) {
    throw new IncubatorTransportError("invalid_response");
  }
  return {
    player: mapPlayer(value.player),
    access: {
      allowed: value.access.allowed,
      used: value.access.used,
      remaining: value.access.remaining,
    },
  };
}

function mapRoomSnapshot(value: unknown): IncubatorRoomSnapshot {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.accessCode !== "string"
    || typeof value.initiatorId !== "string"
    || !Array.isArray(value.participants)
    || !isRecord(value.chambers)
    || typeof value.status !== "string"
    || !FINGERPRINT_STATES.has(value.status as IncubatorFingerprintState)
    || typeof value.createdAt !== "string"
    || typeof value.updatedAt !== "string"
    || typeof value.expiresAt !== "string"
  ) {
    throw new IncubatorTransportError("invalid_response");
  }

  const participants = value.participants.map(mapPlayer);
  const participantIds = new Set(participants.map((participant) => participant.id));
  if (
    participants.length < 1
    || participants.length > 2
    || participantIds.size !== participants.length
    || !participantIds.has(value.initiatorId)
  ) {
    throw new IncubatorTransportError("invalid_response");
  }

  const chambers = value.chambers;
  const mapOccupant = (chamber: IncubatorChamber) => {
    const occupant = chambers[chamber];
    if (occupant === undefined) return undefined;
    if (
      !isRecord(occupant)
      || typeof occupant.subjectId !== "string"
      || typeof occupant.pressed !== "boolean"
    ) {
      throw new IncubatorTransportError("invalid_response");
    }
    return { subjectId: occupant.subjectId, pressed: occupant.pressed };
  };
  const left = mapOccupant("left");
  const right = mapOccupant("right");
  const state = value.status as IncubatorFingerprintState;
  if (
    (left && !participantIds.has(left.subjectId))
    || (right && !participantIds.has(right.subjectId))
    || (left && right && left.subjectId === right.subjectId)
  ) {
    throw new IncubatorTransportError("invalid_response");
  }

  if (
    value.result !== undefined
    && (typeof value.result !== "string" || !REVEAL_CODES.has(value.result as IncubatorRevealCode))
  ) {
    throw new IncubatorTransportError("invalid_response");
  }
  if (value.runId !== undefined && typeof value.runId !== "string") {
    throw new IncubatorTransportError("invalid_response");
  }

  return {
    id: value.id,
    accessCode: value.accessCode,
    initiatorId: value.initiatorId,
    participants,
    state,
    chambers: {
      ...(left ? { left } : {}),
      ...(right ? { right } : {}),
    },
    ...(typeof value.runId === "string" ? { runId: value.runId } : {}),
    ...(typeof value.result === "string" ? { result: value.result as IncubatorRevealCode } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: value.expiresAt,
  };
}

function transportErrorForStatus(status: number): IncubatorTransportError {
  if (status === 401) return new IncubatorTransportError("unauthorized", status);
  if (status === 429) return new IncubatorTransportError("rate_limited", status);
  return new IncubatorTransportError("request_failed", status);
}

function denialForStatus(status: number): IncubatorFingerprintDenialReason | undefined {
  if (status === 403) return "access_denied";
  if (status === 404) return "unknown_session";
  if (status === 400 || status === 409) return "invalid_state";
  return undefined;
}

function browserFetch(options: IncubatorBrowserTransportOptions): typeof fetch {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new IncubatorTransportError("network_error");
  return fetcher;
}

async function request(
  fetcher: typeof fetch,
  path: string,
  init: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(path, { ...init, credentials: "include" });
  } catch {
    throw new IncubatorTransportError("network_error");
  }
  return response;
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new IncubatorTransportError("invalid_response", response.status);
  }
}

export function createServerAuthClient(
  options: IncubatorBrowserTransportOptions = {},
): IncubatorAuthClient {
  const fetcher = browserFetch(options);

  async function projection(path: string, init: RequestInit): Promise<IncubatorPersonalProjection> {
    const response = await request(fetcher, path, init);
    if (!response.ok) throw transportErrorForStatus(response.status);
    return mapPersonalProjection(await readPayload(response));
  }

  return {
    login(playerCode) {
      return projection("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerCode }),
      });
    },
    async logout() {
      const response = await request(fetcher, "/api/auth/logout", { method: "POST" });
      if (!response.ok) throw transportErrorForStatus(response.status);
    },
    getMe() {
      return projection("/api/me", { method: "GET" });
    },
  };
}

export function createServerFingerprintClient(
  options: IncubatorBrowserTransportOptions = {},
): IncubatorServerFingerprintClient {
  const fetcher = browserFetch(options);
  const auth = createServerAuthClient(options);
  const browserGlobals = globalThis as unknown as {
    WebSocket?: WebSocketConstructor;
    document?: VisibilityPort;
    location?: { href: string };
  };
  const WebSocketImpl = options.WebSocket ?? browserGlobals.WebSocket;
  const visibility = options.visibility ?? (
    browserGlobals.document
  );
  const locationHref = options.locationHref ?? (
    browserGlobals.location?.href ?? "http://localhost/"
  );
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  const reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 250;
  const listeners = new Set<(snapshot: IncubatorRoomSnapshot) => void>();
  const transportListeners = new Set<(event: IncubatorFingerprintTransportEvent) => void>();
  let snapshot: IncubatorRoomSnapshot | undefined;
  let socket: WebSocketPort | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempts = 0;
  let recoveryGeneration = 0;
  let recoveryHalted = false;
  let destroyed = false;

  function stopRecovery(): void {
    recoveryGeneration += 1;
    if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  function closeSocket(): void {
    const current = socket;
    socket = undefined;
    if (current && current.readyState < 2) current.close(1000, "client_cleanup");
  }

  function visible(): boolean {
    return !visibility || visibility.visibilityState === "visible";
  }

  function notify(next: IncubatorRoomSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener(next);
  }

  function notifyTransport(event: IncubatorFingerprintTransportEvent): void {
    for (const listener of transportListeners) listener(event);
  }

  function canRecover(generation: number, roomId: string): boolean {
    return (
      !destroyed
      && !recoveryHalted
      && generation === recoveryGeneration
      && listeners.size > 0
      && snapshot?.id === roomId
      && !TERMINAL_STATES.has(snapshot.state)
      && visible()
    );
  }

  function haltRecovery(event: IncubatorFingerprintTransportEvent): void {
    recoveryHalted = true;
    stopRecovery();
    closeSocket();
    notifyTransport(event);
  }

  function scheduleRecovery(roomId: string, action: "probe" | "connect"): void {
    if (
      destroyed
      || recoveryHalted
      || reconnectTimer !== undefined
      || listeners.size === 0
      || snapshot?.id !== roomId
      || TERMINAL_STATES.has(snapshot.state)
      || !visible()
    ) return;
    if (reconnectAttempts >= maxReconnectAttempts) {
      haltRecovery({ type: "connection_interrupted", reason: "network_error" });
      return;
    }
    const delay = reconnectBaseDelayMs * (2 ** reconnectAttempts);
    reconnectAttempts += 1;
    const generation = recoveryGeneration;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (!canRecover(generation, roomId)) return;
      if (action === "probe") void probeRoom(roomId, generation);
      else connectSocket();
    }, delay);
  }

  async function denialReasonFromProbe(
    response: Response,
  ): Promise<"unknown_session" | "session_closed" | undefined> {
    if (response.status === 404) return "unknown_session";
    if (response.status !== 409) return undefined;
    try {
      const payload: unknown = await response.json();
      if (
        isRecord(payload)
        && (payload.reason === "session_closed" || payload.error === "session_closed")
      ) return "session_closed";
    } catch {
      // A non-JSON error remains a regular transport failure.
    }
    return undefined;
  }

  async function probeRoom(roomId: string, generation: number): Promise<void> {
    if (!canRecover(generation, roomId)) return;
    let response: Response;
    try {
      response = await request(
        fetcher,
        `/api/incubations/${encodeURIComponent(roomId)}`,
        { method: "GET" },
      );
    } catch {
      if (canRecover(generation, roomId)) scheduleRecovery(roomId, "probe");
      return;
    }
    if (!canRecover(generation, roomId)) return;
    if (!response.ok) {
      const reason = await denialReasonFromProbe(response);
      if (!canRecover(generation, roomId)) return;
      if (reason) {
        haltRecovery({ type: "session_unavailable", reason });
        return;
      }
      scheduleRecovery(roomId, "probe");
      return;
    }
    let next: IncubatorRoomSnapshot;
    try {
      next = mapRoomSnapshot(await readPayload(response));
    } catch {
      if (canRecover(generation, roomId)) scheduleRecovery(roomId, "probe");
      return;
    }
    if (!canRecover(generation, roomId) || next.id !== roomId) return;
    notify(next);
    if (TERMINAL_STATES.has(next.state)) {
      stopRecovery();
      return;
    }
    scheduleRecovery(roomId, "connect");
  }

  function beginRecovery(roomId: string): void {
    if (recoveryHalted || !snapshot || snapshot.id !== roomId) return;
    stopRecovery();
    const generation = recoveryGeneration;
    void probeRoom(roomId, generation);
  }

  function connectSocket(): void {
    if (
      destroyed
      || socket
      || recoveryHalted
      || !WebSocketImpl
      || listeners.size === 0
      || !snapshot
      || TERMINAL_STATES.has(snapshot.state)
      || !visible()
    ) return;
    const url = new URL("/ws", locationHref);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("incubationId", snapshot.id);
    const current = new WebSocketImpl(url) as WebSocketPort;
    socket = current;
    current.onopen = () => {
      if (socket === current) reconnectAttempts = 0;
    };
    current.onmessage = (event) => {
      if (socket !== current || typeof event.data !== "string") return;
      try {
        const message: unknown = JSON.parse(event.data);
        if (
          !isRecord(message)
          || message.type !== "incubation.snapshot"
          || !("snapshot" in message)
        ) return;
        const next = mapRoomSnapshot(message.snapshot);
        if (next.id !== snapshot?.id) return;
        notify(next);
        if (TERMINAL_STATES.has(next.state)) {
          stopRecovery();
          closeSocket();
        }
      } catch {
        // Invalid push payloads are ignored; the last validated snapshot remains authoritative.
      }
    };
    current.onerror = () => undefined;
    current.onclose = () => {
      if (socket !== current) return;
      socket = undefined;
      const roomId = snapshot?.id;
      if (roomId) beginRecovery(roomId);
    };
  }

  function adopt(next: IncubatorRoomSnapshot): void {
    const changedRoom = snapshot?.id !== next.id;
    if (changedRoom) {
      stopRecovery();
      closeSocket();
      reconnectAttempts = 0;
    }
    recoveryHalted = false;
    notify(next);
    connectSocket();
  }

  async function roomRequest(
    path: string,
    init: RequestInit,
  ): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>> {
    const response = await request(fetcher, path, init);
    if (!response.ok) {
      const denial = denialForStatus(response.status);
      if (denial) return { ok: false, reason: denial };
      throw transportErrorForStatus(response.status);
    }
    const next = mapRoomSnapshot(await readPayload(response));
    adopt(next);
    return { ok: true, snapshot: next };
  }

  function requireRoom(): string | undefined {
    return snapshot?.id;
  }

  function mutate(
    chamber: IncubatorChamber,
    method: "POST" | "DELETE",
  ): Promise<IncubatorFingerprintResult<IncubatorRoomSnapshot>> {
    const roomId = requireRoom();
    if (!roomId || !CHAMBERS.has(chamber)) {
      return Promise.resolve({ ok: false, reason: "unknown_session" });
    }
    return roomRequest(
      `/api/incubations/${encodeURIComponent(roomId)}/chambers/${chamber}/fingerprint`,
      { method },
    );
  }

  function handleVisibility(): void {
    if (visible()) {
      connectSocket();
    } else {
      stopRecovery();
      closeSocket();
    }
  }
  visibility?.addEventListener("visibilitychange", handleVisibility);

  return {
    createSession(accessCode) {
      return roomRequest("/api/incubations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
    },
    joinSession(accessCode) {
      return roomRequest("/api/incubations/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
    },
    getSnapshot() {
      return snapshot;
    },
    refreshSnapshot() {
      const roomId = requireRoom();
      if (!roomId) return Promise.resolve({ ok: false, reason: "unknown_session" });
      return roomRequest(`/api/incubations/${encodeURIComponent(roomId)}`, { method: "GET" });
    },
    async getAccessCounter(): Promise<IncubatorAccessCounter> {
      const me = await auth.getMe();
      return { used: me.access.used, remaining: me.access.remaining };
    },
    subscribe(listener) {
      listeners.add(listener);
      if (snapshot) listener(snapshot);
      connectSocket();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopRecovery();
          closeSocket();
          reconnectAttempts = 0;
        }
      };
    },
    subscribeTransport(listener) {
      transportListeners.add(listener);
      return () => {
        transportListeners.delete(listener);
      };
    },
    press(chamber) {
      return mutate(chamber, "POST");
    },
    release(chamber) {
      return mutate(chamber, "DELETE");
    },
    disconnect(chamber) {
      return mutate(chamber, "DELETE");
    },
    cancel() {
      const roomId = requireRoom();
      if (!roomId) return Promise.resolve({ ok: false, reason: "unknown_session" });
      return roomRequest(`/api/incubations/${encodeURIComponent(roomId)}`, { method: "DELETE" });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      transportListeners.clear();
      stopRecovery();
      closeSocket();
      visibility?.removeEventListener("visibilitychange", handleVisibility);
    },
  };
}
