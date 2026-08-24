import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import type {
  IncubatorChamber,
  IncubatorFingerprintSnapshot,
  IncubatorPlayerPublic,
  IncubatorRevealCode,
  IncubatorSession,
} from "../../types";
import { createMemoryStore, type IncubatorMemoryStore } from "../store";
import {
  createFileAccessGrantLedger,
  type AccessGrantLedger,
} from "./accessGrantLedger";
import {
  normalizeAccessCode,
  type AccessGrantVerifier,
  verifyCanonicalAccessGrant,
} from "./accessGrantVerifier";
import {
  createFingerprintSessionAuthority,
  type FingerprintSessionAuthority,
} from "./fingerprintSession";
import {
  type PlayerCodeVerifier,
  verifyCanonicalPlayerCode,
} from "./playerCodeVerifier";
import { seedBiologicalSignatures } from "./signatures";

const COOKIE_NAME = "labo_session";
const CHAMBERS = new Set<IncubatorChamber>(["left", "right"]);

export interface IncubatorServerConfig {
  production?: boolean;
  sessionTtlMs?: number;
  incubationTtlMs?: number;
  syncDurationMs?: number;
  analysisDurationMs?: number;
  disconnectGraceMs?: number;
  participantDisconnectGraceMs?: number;
  rateLimitWindowMs?: number;
  loginRateLimitMax?: number;
  joinRateLimitMax?: number;
  jsonLimitBytes?: number;
  heartbeatMs?: number;
  accessLedgerPath?: string;
}

export interface CreateIncubatorServerOptions {
  config: IncubatorServerConfig;
  store?: IncubatorMemoryStore;
  now?: () => Date;
  compare?: (leftId: string, rightId: string) => IncubatorRevealCode;
  verifyPlayerCode?: PlayerCodeVerifier;
  verifyAccessGrant?: AccessGrantVerifier;
  accessGrantLedger?: AccessGrantLedger;
}

export interface IncubatorNodeServer {
  server: Server;
  store: IncubatorMemoryStore;
  dispatch(request: IncomingMessage, response: ServerResponse): Promise<void>;
  listen(port?: number, host?: string): Promise<AddressInfo>;
  close(): Promise<void>;
}

interface AuthSession {
  playerId: string;
  expiresAt: number;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

interface Room {
  id: string;
  accessCode: string;
  accessGrantId: string;
  accessGrantConsumed: boolean;
  initiatorId: string;
  participants: Set<string>;
  connected: Map<string, number>;
  departureTimers: Map<string, ReturnType<typeof setTimeout>>;
  expiresAt: number;
  resolveTimer?: ReturnType<typeof setTimeout>;
  unsubscribe: () => void;
  sockets: Set<WebSocket>;
}

type PublicParticipant = IncubatorPlayerPublic;

interface PublicRoomSnapshot {
  id: string;
  accessCode: string;
  initiatorId: string;
  participants: PublicParticipant[];
  chambers: IncubatorFingerprintSnapshot["chambers"];
  status: IncubatorFingerprintSnapshot["state"];
  result?: IncubatorRevealCode;
  runId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

type RoomEvent =
  | "snapshot"
  | "participant.joined"
  | "participant.left"
  | "chamber.pressed"
  | "chamber.released"
  | "syncing"
  | "analyzing"
  | "resolved"
  | "cancelled";

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

export function loadIncubatorServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): IncubatorServerConfig {
  const numberFrom = (key: string): number | undefined => {
    const raw = env[key];
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  return {
    production: env.NODE_ENV === "production" || env.VERCEL === "1",
    sessionTtlMs: numberFrom("LABO_SESSION_TTL_MS"),
    incubationTtlMs: numberFrom("LABO_INCUBATION_TTL_MS"),
    syncDurationMs: numberFrom("LABO_SYNC_DURATION_MS"),
    analysisDurationMs: numberFrom("LABO_ANALYSIS_DURATION_MS"),
    disconnectGraceMs: numberFrom("LABO_DISCONNECT_GRACE_MS"),
    participantDisconnectGraceMs: numberFrom("LABO_PARTICIPANT_DISCONNECT_GRACE_MS"),
    rateLimitWindowMs: numberFrom("LABO_RATE_LIMIT_WINDOW_MS"),
    loginRateLimitMax: numberFrom("LABO_LOGIN_RATE_LIMIT_MAX"),
    joinRateLimitMax: numberFrom("LABO_JOIN_RATE_LIMIT_MAX"),
    accessLedgerPath: env.LABO_ACCESS_LEDGER_PATH
      ?? (env.VERCEL ? "/tmp/incubator-access-ledger.json" : undefined),
  };
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies.set(name, value);
  }
  return cookies;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const first = raw.split(",")[0]?.trim();
  return first || undefined;
}

function requestHost(request: IncomingMessage): string | undefined {
  return headerValue(request.headers["x-forwarded-host"]) ?? request.headers.host;
}

function requestIp(request: IncomingMessage): string {
  return headerValue(request.headers["x-forwarded-for"])
    ?? request.socket.remoteAddress
    ?? "unknown";
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function sendEmpty(response: ServerResponse, status = 204): void {
  response.writeHead(status, { "cache-control": "no-store" });
  response.end();
}

async function readJson(
  request: IncomingMessage,
  limitBytes: number,
): Promise<Record<string, unknown>> {
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim();
  if (contentType !== "application/json") throw new Error("invalid_json");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limitBytes) throw new Error("payload_too_large");
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid_json");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid_json");
  }
  return value as Record<string, unknown>;
}

async function assertEmptyBody(request: IncomingMessage, limitBytes: number): Promise<void> {
  let size = 0;
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > limitBytes) throw new Error("payload_too_large");
  }
  if (size !== 0) throw new Error("invalid_empty_body");
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function eventFor(snapshot: IncubatorFingerprintSnapshot): RoomEvent {
  if (snapshot.state === "SYNCING") return "syncing";
  if (snapshot.state === "ANALYZING") return "analyzing";
  if (snapshot.state === "RESOLVED") return "resolved";
  if (snapshot.state === "CANCELLED") return "cancelled";
  return "snapshot";
}

export function createIncubatorNodeServer(
  options: CreateIncubatorServerOptions,
): IncubatorNodeServer {
  const store = options.store ?? createMemoryStore();
  seedBiologicalSignatures([...store.players.keys()]);
  const now = options.now ?? (() => new Date());
  const epoch = () => now().getTime();
  const sessionTtlMs = positive(options.config.sessionTtlMs, 8 * 60 * 60 * 1_000);
  const incubationTtlMs = positive(options.config.incubationTtlMs, 15 * 60 * 1_000);
  const analysisDurationMs = positive(options.config.analysisDurationMs, 8_200);
  const disconnectGraceMs = positive(options.config.disconnectGraceMs, 150);
  const participantDisconnectGraceMs = positive(
    options.config.participantDisconnectGraceMs,
    30_000,
  );
  const rateWindowMs = positive(options.config.rateLimitWindowMs, 60_000);
  const loginLimit = positive(options.config.loginRateLimitMax, 8);
  const joinLimit = positive(options.config.joinRateLimitMax, 12);
  const jsonLimit = positive(options.config.jsonLimitBytes, 16_384);
  const heartbeatMs = positive(options.config.heartbeatMs, 30_000);
  const verifyPlayerCode = options.verifyPlayerCode ?? verifyCanonicalPlayerCode;
  const verifyAccessGrant = options.verifyAccessGrant ?? verifyCanonicalAccessGrant;
  const accessGrantLedger = options.accessGrantLedger
    ?? createFileAccessGrantLedger(
      options.config.accessLedgerPath ?? ".data/incubator-access-ledger.json",
    );
  const sessions = new Map<string, AuthSession>();
  const rooms = new Map<string, Room>();
  const codes = new Map<string, string>();
  const grantReservations = new Map<string, string>();
  const loginRates = new Map<string, RateBucket>();
  const joinRates = new Map<string, RateBucket>();
  let shuttingDown = false;
  const authority: FingerprintSessionAuthority = createFingerprintSessionAuthority({
    store,
    syncDurationMs: positive(options.config.syncDurationMs, 1_800),
    gracePeriodMs: disconnectGraceMs,
    compare: options.compare,
    now,
    authorizeAnalysis(sessionId) {
      const room = rooms.get(sessionId);
      if (
        !room
        || room.accessGrantConsumed
        || grantReservations.get(room.accessGrantId) !== room.id
      ) {
        return false;
      }
      if (!accessGrantLedger.consume(room.accessGrantId)) return false;
      room.accessGrantConsumed = true;
      grantReservations.delete(room.accessGrantId);
      return true;
    },
  });

  function consumeRate(
    buckets: Map<string, RateBucket>,
    key: string,
    maximum: number,
  ): boolean {
    const timestamp = epoch();
    const bucket = buckets.get(key);
    if (!bucket || timestamp >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: timestamp + rateWindowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= maximum;
  }

  function authenticate(request: IncomingMessage): IncubatorSession | undefined {
    const token = parseCookies(request.headers.cookie).get(COOKIE_NAME);
    if (!token) return undefined;
    const session = sessions.get(token);
    if (!session || session.expiresAt <= epoch()) {
      if (session) sessions.delete(token);
      return undefined;
    }
    if (!store.players.has(session.playerId)) return undefined;
    return { actor: "joueur", actorId: session.playerId };
  }

  function roomForParticipant(
    roomId: string,
    authenticated: IncubatorSession,
  ): Room | undefined {
    const room = rooms.get(roomId);
    const fingerprint = room ? authority.getSnapshot(room.id) : undefined;
    const expiredBeforeAnalysis =
      room
      && room.expiresAt <= epoch()
      && fingerprint?.state !== "ANALYZING"
      && fingerprint?.state !== "RESOLVED";
    if (
      !room
      || expiredBeforeAnalysis
      || !room.participants.has(authenticated.actorId)
    ) {
      return undefined;
    }
    return room;
  }

  function project(room: Room): PublicRoomSnapshot {
    const fingerprint = authority.getSnapshot(room.id);
    if (!fingerprint) throw new Error("authority_session_missing");
    const participants = [...room.participants].flatMap((playerId): PublicParticipant[] => {
      const player = store.players.get(playerId);
      return player
        ? [{
            id: player.id,
            displayName: player.displayName,
            status: player.status,
          }]
        : [];
    });
    return {
      id: room.id,
      accessCode: room.accessCode,
      initiatorId: room.initiatorId,
      participants,
      chambers: fingerprint.chambers,
      status: fingerprint.state,
      ...(fingerprint.state === "RESOLVED" && fingerprint.result
        ? { result: fingerprint.result }
        : {}),
      ...(fingerprint.state === "RESOLVED" && fingerprint.runId
        ? { runId: fingerprint.runId }
        : {}),
      createdAt: fingerprint.createdAt,
      updatedAt: fingerprint.updatedAt,
      expiresAt: new Date(room.expiresAt).toISOString(),
    };
  }

  function broadcast(room: Room, event: RoomEvent): void {
    const message = JSON.stringify({
      type: "incubation.snapshot",
      event,
      snapshot: project(room),
    });
    for (const socket of room.sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }

  function clearDepartureTimers(room: Room): void {
    for (const timer of room.departureTimers.values()) clearTimeout(timer);
    room.departureTimers.clear();
  }

  function disconnectFingerprint(room: Room, authenticated: IncubatorSession): void {
    const fingerprint = authority.getSnapshot(room.id);
    for (const chamber of ["left", "right"] as const) {
      if (fingerprint?.chambers[chamber]?.subjectId === authenticated.actorId) {
        authority.disconnect(room.id, authenticated, chamber);
      }
    }
  }

  function restoreFingerprintAfterReconnect(
    room: Room,
    authenticated: IncubatorSession,
  ): void {
    const departureTimer = room.departureTimers.get(authenticated.actorId);
    if (!departureTimer) return;
    clearTimeout(departureTimer);
    room.departureTimers.delete(authenticated.actorId);

    // Reasserting the server-owned chamber cancels the authority's matching
    // disconnect grace without accepting a client-supplied subject identity.
    const fingerprint = authority.getSnapshot(room.id);
    for (const chamber of ["left", "right"] as const) {
      const occupant = fingerprint?.chambers[chamber];
      if (occupant?.subjectId === authenticated.actorId && occupant.pressed) {
        authority.press(room.id, authenticated, chamber);
      }
    }
  }

  function scheduleParticipantDeparture(
    room: Room,
    authenticated: IncubatorSession,
  ): void {
    if (shuttingDown || rooms.get(room.id) !== room) return;
    if (room.departureTimers.has(authenticated.actorId)) return;
    const fingerprint = authority.getSnapshot(room.id);
    // Once analysis starts, the two run participants are historical facts.
    // Presence cleanup must not rewrite an analyzing or resolved run.
    if (fingerprint?.state === "ANALYZING" || fingerprint?.state === "RESOLVED") return;

    disconnectFingerprint(room, authenticated);
    const timer = setTimeout(() => {
      room.departureTimers.delete(authenticated.actorId);
      if ((room.connected.get(authenticated.actorId) ?? 0) > 0) return;
      const current = authority.getSnapshot(room.id);
      if (current?.state === "ANALYZING" || current?.state === "RESOLVED") return;
      if (!room.participants.delete(authenticated.actorId)) return;
      if (authenticated.actorId === room.initiatorId) {
        authority.cancel(room.id, authenticated);
      }
      broadcast(room, "participant.left");
      if (authenticated.actorId === room.initiatorId) {
        room.unsubscribe();
        if (room.resolveTimer) clearTimeout(room.resolveTimer);
        clearDepartureTimers(room);
        codes.delete(room.accessCode);
        rooms.delete(room.id);
        for (const socket of room.sockets) socket.close(1001, "initiator_departed");
      }
    }, participantDisconnectGraceMs);
    room.departureTimers.set(authenticated.actorId, timer);
  }

  function releaseReservation(room: Room): void {
    if (room.accessGrantConsumed) return;
    const snapshot = authority.getSnapshot(room.id);
    if (snapshot?.state === "ANALYZING" || snapshot?.state === "RESOLVED") return;
    if (grantReservations.get(room.accessGrantId) === room.id) {
      grantReservations.delete(room.accessGrantId);
    }
    if (codes.get(room.accessCode) === room.id) {
      codes.delete(room.accessCode);
    }
  }

  async function createRoom(
    authenticated: IncubatorSession,
    accessCodeInput: string,
  ): Promise<Room | undefined> {
    const player = store.players.get(authenticated.actorId);
    if (!player || player.status !== "actif") return undefined;
    const accessCode = normalizeAccessCode(accessCodeInput);
    if (!accessCode) return undefined;
    const accessGrantId = await verifyAccessGrant(accessCode);
    if (
      !accessGrantId
      || accessGrantLedger.isConsumed(accessGrantId)
      || grantReservations.has(accessGrantId)
    ) return undefined;
    const created = authority.createSession(authenticated);
    if (!created.ok) return undefined;
    grantReservations.set(accessGrantId, created.snapshot.id);
    const room: Room = {
      id: created.snapshot.id,
      accessCode,
      accessGrantId,
      accessGrantConsumed: false,
      initiatorId: authenticated.actorId,
      participants: new Set([authenticated.actorId]),
      connected: new Map(),
      departureTimers: new Map(),
      expiresAt: epoch() + incubationTtlMs,
      unsubscribe: () => undefined,
      sockets: new Set(),
    };
    rooms.set(room.id, room);
    codes.set(accessCode, room.id);
    room.unsubscribe = authority.subscribe(room.id, (snapshot) => {
      if (snapshot.state === "ANALYZING" && !room.resolveTimer) {
        clearDepartureTimers(room);
        room.resolveTimer = setTimeout(() => {
          room.resolveTimer = undefined;
          authority.resolve(room.id);
        }, analysisDurationMs);
      }
      if (snapshot.state === "RESOLVED" || snapshot.state === "CANCELLED") {
        clearDepartureTimers(room);
      }
      if (snapshot.state === "CANCELLED") releaseReservation(room);
      broadcast(room, eventFor(snapshot));
    });
    return room;
  }

  function deny(response: ServerResponse, status = 403): void {
    sendJson(response, status, { error: "request_denied" });
  }

  function sameOrigin(request: IncomingMessage): boolean {
    const origin = request.headers.origin;
    if (!origin) return true;
    const host = requestHost(request);
    if (!host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      const method = request.method ?? "";
      const url = new URL(request.url ?? "/", "http://localhost");
      const path = url.pathname;
      if (!sameOrigin(request)) {
        deny(response);
        return;
      }

      if (method === "POST" && path === "/api/auth/login") {
        if (!consumeRate(loginRates, requestIp(request), loginLimit)) {
          sendJson(response, 429, { error: "too_many_requests" });
          return;
        }
        const body = await readJson(request, jsonLimit);
        if (
          !hasExactKeys(body, ["playerCode"])
          || typeof body.playerCode !== "string"
        ) {
          deny(response, 401);
          return;
        }
        const playerId = await verifyPlayerCode(body.playerCode);
        if (!playerId || !store.players.has(playerId)) {
          deny(response, 401);
          return;
        }
        const token = randomBytes(32).toString("base64url");
        sessions.set(token, { playerId, expiresAt: epoch() + sessionTtlMs });
        response.setHeader(
          "set-cookie",
          `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(sessionTtlMs / 1_000)}${options.config.production ? "; Secure" : ""}`,
        );
        sendJson(response, 200, personalProjection(store, playerId));
        return;
      }

      if (method === "POST" && path === "/api/auth/logout") {
        const token = parseCookies(request.headers.cookie).get(COOKIE_NAME);
        if (token) sessions.delete(token);
        response.setHeader(
          "set-cookie",
          `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${options.config.production ? "; Secure" : ""}`,
        );
        sendEmpty(response);
        return;
      }

      const authenticated = authenticate(request);
      if (method === "GET" && path === "/api/me") {
        if (!authenticated) {
          deny(response, 401);
          return;
        }
        sendJson(response, 200, personalProjection(store, authenticated.actorId));
        return;
      }

      if (!authenticated) {
        deny(response, 401);
        return;
      }

      if (method === "POST" && path === "/api/incubations") {
        if (!consumeRate(joinRates, requestIp(request), joinLimit)) {
          sendJson(response, 429, { error: "too_many_requests" });
          return;
        }
        const body = await readJson(request, jsonLimit);
        if (!hasExactKeys(body, ["accessCode"]) || typeof body.accessCode !== "string") {
          deny(response, 400);
          return;
        }
        const room = await createRoom(authenticated, body.accessCode);
        if (!room) {
          deny(response);
          return;
        }
        sendJson(response, 201, project(room));
        return;
      }

      if (method === "POST" && path === "/api/incubations/join") {
        if (!consumeRate(joinRates, requestIp(request), joinLimit)) {
          sendJson(response, 429, { error: "too_many_requests" });
          return;
        }
        const body = await readJson(request, jsonLimit);
        if (!hasExactKeys(body, ["accessCode"]) || typeof body.accessCode !== "string") {
          deny(response, 400);
          return;
        }
        const accessCode = normalizeAccessCode(body.accessCode);
        const roomId = accessCode ? codes.get(accessCode) : undefined;
        const room = roomId ? rooms.get(roomId) : undefined;
        if (!room || room.expiresAt <= epoch()) {
          deny(response, 404);
          return;
        }
        if (!room.participants.has(authenticated.actorId) && room.participants.size >= 2) {
          deny(response, 409);
          return;
        }
        const joined = !room.participants.has(authenticated.actorId);
        room.participants.add(authenticated.actorId);
        if (joined) broadcast(room, "participant.joined");
        sendJson(response, 200, project(room));
        return;
      }

      const roomMatch = path.match(/^\/api\/incubations\/([^/]+)$/);
      if (roomMatch) {
        const roomId = decodeURIComponent(roomMatch[1]!);
        const room = roomForParticipant(roomId, authenticated);
        if (!room) {
          deny(response, 404);
          return;
        }
        if (method === "GET") {
          sendJson(response, 200, project(room));
          return;
        }
        if (method === "DELETE") {
          await assertEmptyBody(request, jsonLimit);
          if (room.initiatorId !== authenticated.actorId) {
            deny(response);
            return;
          }
          const result = authority.cancel(room.id, authenticated);
          if (!result.ok) {
            deny(response);
            return;
          }
          sendJson(response, 200, project(room));
          return;
        }
      }

      const chamberMatch = path.match(
        /^\/api\/incubations\/([^/]+)\/chambers\/([^/]+)\/fingerprint$/,
      );
      if (chamberMatch && (method === "POST" || method === "DELETE")) {
        const roomId = decodeURIComponent(chamberMatch[1]!);
        const chamber = decodeURIComponent(chamberMatch[2]!) as IncubatorChamber;
        const room = roomForParticipant(roomId, authenticated);
        if (!room || !CHAMBERS.has(chamber)) {
          deny(response, 404);
          return;
        }
        await assertEmptyBody(request, jsonLimit);
        const result = method === "POST"
          ? authority.press(room.id, authenticated, chamber)
          : authority.release(room.id, authenticated, chamber);
        if (!result.ok) {
          deny(response, 409);
          return;
        }
        broadcast(room, method === "POST" ? "chamber.pressed" : "chamber.released");
        sendJson(response, 200, project(room));
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof Error && error.message === "payload_too_large") {
        sendJson(response, 413, { error: "payload_too_large" });
      } else if (error instanceof Error && error.message === "invalid_json") {
        sendJson(response, 400, { error: "invalid_json" });
      } else if (error instanceof Error && error.message === "invalid_empty_body") {
        sendJson(response, 400, { error: "invalid_body" });
      } else {
        sendJson(response, 500, { error: "internal_error" });
      }
    }
  }

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });

  const webSockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const authenticated = authenticate(request);
    const roomId = url.searchParams.get("incubationId");
    const room = authenticated && roomId ? roomForParticipant(roomId, authenticated) : undefined;
    if (url.pathname !== "/ws" || !sameOrigin(request) || !authenticated || !room) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      webSockets.emit("connection", webSocket, request, room, authenticated);
    });
  });

  webSockets.on(
    "connection",
    (socket: WebSocket, _request: IncomingMessage, room: Room, authenticated: IncubatorSession) => {
      if (!room.participants.has(authenticated.actorId)) {
        socket.close(1008, "participant_departed");
        return;
      }
      room.sockets.add(socket);
      room.connected.set(
        authenticated.actorId,
        (room.connected.get(authenticated.actorId) ?? 0) + 1,
      );
      restoreFingerprintAfterReconnect(room, authenticated);
      socket.send(JSON.stringify({
        type: "incubation.snapshot",
        event: "snapshot",
        snapshot: project(room),
      }));
      socket.on("message", () => socket.close(1008, "push_only"));
      socket.on("pong", () => {
        Object.assign(socket, { isAlive: true });
      });
      socket.on("close", () => {
        room.sockets.delete(socket);
        const remaining = Math.max(0, (room.connected.get(authenticated.actorId) ?? 1) - 1);
        room.connected.set(authenticated.actorId, remaining);
        if (remaining === 0) {
          scheduleParticipantDeparture(room, authenticated);
        }
      });
    },
  );

  const maintenance = setInterval(() => {
    const timestamp = epoch();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= timestamp) sessions.delete(token);
    }
    for (const room of rooms.values()) {
      if (room.expiresAt <= timestamp) {
        const snapshot = authority.getSnapshot(room.id);
        if (snapshot?.state === "ANALYZING") continue;
        authority.cancel(room.id, { actor: "joueur", actorId: room.initiatorId });
        for (const socket of room.sockets) socket.close(1001, "expired");
        room.unsubscribe();
        if (room.resolveTimer) clearTimeout(room.resolveTimer);
        clearDepartureTimers(room);
        codes.delete(room.accessCode);
        rooms.delete(room.id);
      }
    }
    for (const socket of webSockets.clients) {
      const tracked = socket as WebSocket & { isAlive?: boolean };
      if (tracked.isAlive === false) {
        tracked.terminate();
        continue;
      }
      tracked.isAlive = false;
      tracked.ping();
    }
  }, heartbeatMs);
  maintenance.unref();

  return {
    server,
    store,
    dispatch: handleRequest,
    listen(port = 0, host = "127.0.0.1") {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve(server.address() as AddressInfo);
        });
      });
    },
    close() {
      shuttingDown = true;
      clearInterval(maintenance);
      for (const room of rooms.values()) {
        room.unsubscribe();
        if (room.resolveTimer) clearTimeout(room.resolveTimer);
        clearDepartureTimers(room);
        releaseReservation(room);
      }
      for (const socket of webSockets.clients) socket.terminate();
      return new Promise((resolve, reject) => {
        webSockets.close(() => {
          server.close((error) => error ? reject(error) : resolve());
        });
      });
    },
  };
}

function personalProjection(store: IncubatorMemoryStore, playerId: string): {
  player: IncubatorPlayerPublic;
  access: { allowed: boolean; used: number; remaining: number };
} {
  const player = store.players.get(playerId);
  if (!player) throw new Error("unknown_player");
  const counter = store.access.get(playerId) ?? { used: 0, remaining: 0 };
  return {
    player: {
      id: player.id,
      displayName: player.displayName,
      status: player.status,
    },
    access: {
      allowed: player.status === "actif",
      used: counter.used,
      remaining: counter.remaining,
    },
  };
}
