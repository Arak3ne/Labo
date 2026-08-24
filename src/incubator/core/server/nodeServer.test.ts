/* eslint-disable @typescript-eslint/no-explicit-any -- JSON transport assertions are intentionally dynamic. */
import { mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createMemoryStore } from "../store";
import {
  createFileAccessGrantLedger,
  createMemoryAccessGrantLedger,
  type AccessGrantLedger,
} from "./accessGrantLedger";
import {
  createIncubatorNodeServer,
  loadIncubatorServerConfig,
  type IncubatorNodeServer,
  type IncubatorServerConfig,
} from "./nodeServer";

interface HttpResult {
  status: number;
  body: Record<string, any>;
  cookie?: string;
}

const testCodes = new Map([
  ["TEST-A1", "A1"],
  ["TEST-A2", "A2"],
  ["TEST-A3", "A3"],
  ["TEST-D2", "D2"],
]);
const testAccessGrants = new Map([
  ["A1-B2", "01"],
  ["C3-D4", "02"],
  ["E5-F6", "03"],
]);

describe("authoritative incubator Node server", () => {
  let app: IncubatorNodeServer;
  let address: AddressInfo;
  let baseConfig: IncubatorServerConfig;
  let ledger: AccessGrantLedger;
  const temporaryDirectories: string[] = [];

  beforeEach(async () => {
    baseConfig = {
      sessionTtlMs: 60_000,
      incubationTtlMs: 60_000,
      syncDurationMs: 25,
      analysisDurationMs: 25,
      disconnectGraceMs: 30,
      participantDisconnectGraceMs: 30,
      rateLimitWindowMs: 60_000,
      loginRateLimitMax: 3,
      joinRateLimitMax: 10,
      heartbeatMs: 60_000,
    };
    ledger = createMemoryAccessGrantLedger();
    app = createIncubatorNodeServer({
      config: baseConfig,
      store: createMemoryStore(1),
      compare: () => "M",
      verifyPlayerCode: async (playerCode) => testCodes.get(playerCode),
      verifyAccessGrant: async (accessCode) => testAccessGrants.get(accessCode),
      accessGrantLedger: ledger,
    });
    address = await app.listen();
  });

  afterEach(async () => {
    await app.close();
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    cookie?: string,
  ): Promise<HttpResult> {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const request = httpRequest({
        host: address.address,
        port: address.port,
        method,
        path,
        headers: {
          ...(encoded === undefined
            ? {}
            : {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(encoded),
              }),
          ...(cookie ? { cookie } : {}),
        },
      }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const setCookie = response.headers["set-cookie"]?.[0]?.split(";")[0];
          resolve({
            status: response.statusCode ?? 0,
            body: text ? JSON.parse(text) : {},
            ...(setCookie ? { cookie: setCookie } : {}),
          });
        });
      });
      request.on("error", reject);
      if (encoded) request.write(encoded);
      request.end();
    });
  }

  it("loads and starts without legacy credential environment variables", () => {
    const config = loadIncubatorServerConfig({
      LABO_DISCONNECT_GRACE_MS: "150",
      LABO_PARTICIPANT_DISCONNECT_GRACE_MS: "30000",
    });
    expect(config.production).toBe(false);
    expect(config.disconnectGraceMs).toBe(150);
    expect(config.participantDisconnectGraceMs).toBe(30_000);
    expect(config).not.toHaveProperty("sharedPassword");
    expect(config).not.toHaveProperty("playerCodes");
    expect(() => createIncubatorNodeServer({
      config,
      verifyPlayerCode: async () => undefined,
    })).not.toThrow();
  });

  it("uses an ephemeral ledger path on Vercel", () => {
    const config = loadIncubatorServerConfig({
      VERCEL: "1",
    });
    expect(config.production).toBe(true);
    expect(config.accessLedgerPath).toBe("/tmp/incubator-access-ledger.json");
  });

  it("answers GET /api/me as unauthorized over the fetch adapter", async () => {
    const isolated = createIncubatorNodeServer({
      config: baseConfig,
      store: createMemoryStore(1),
      verifyPlayerCode: async () => undefined,
      accessGrantLedger: createMemoryAccessGrantLedger(),
    });
    const response = await isolated.dispatchWeb(new Request("http://localhost/api/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "request_denied" });
    await isolated.close();
  });

  it("answers GET /api/me without waiting for a request body", async () => {
    const isolated = createIncubatorNodeServer({
      config: baseConfig,
      store: createMemoryStore(1),
      verifyPlayerCode: async () => undefined,
      accessGrantLedger: createMemoryAccessGrantLedger(),
    });
    const hanging = {
      method: "GET",
      url: "http://localhost/api/me",
      headers: new Headers(),
      arrayBuffer: () => new Promise<ArrayBuffer>(() => {}),
    } as Request;
    const response = await Promise.race([
      isolated.dispatchWeb(hanging),
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error("timed_out")), 200);
      }),
    ]);
    expect(response.status).toBe(401);
    await isolated.close();
  });

  it("reads POST login bodies over the fetch adapter", async () => {
    const isolated = createIncubatorNodeServer({
      config: baseConfig,
      store: createMemoryStore(1),
      verifyPlayerCode: async (playerCode) => testCodes.get(playerCode),
      accessGrantLedger: createMemoryAccessGrantLedger(),
    });
    const response = await isolated.dispatchWeb(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerCode: "TEST-A1" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("labo_session=");
    await isolated.close();
  });

  async function login(playerCode: string): Promise<HttpResult> {
    return call("POST", "/api/auth/login", { playerCode });
  }

  async function createRoom(cookie: string, accessCode = "A1-B2"): Promise<HttpResult> {
    return call("POST", "/api/incubations", { accessCode }, cookie);
  }

  async function replaceServer(
    accessGrantLedger: AccessGrantLedger,
    config: IncubatorServerConfig = baseConfig,
  ): Promise<void> {
    await app.close();
    app = createIncubatorNodeServer({
      config,
      store: createMemoryStore(1),
      compare: () => "M",
      verifyPlayerCode: async (playerCode) => testCodes.get(playerCode),
      verifyAccessGrant: async (accessCode) => testAccessGrants.get(accessCode),
      accessGrantLedger,
    });
    address = await app.listen();
  }

  function connect(roomId: string, cookie: string, origin?: string): Promise<{
    socket: WebSocket;
    messages: any[];
  }> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `ws://${address.address}:${address.port}/ws?incubationId=${encodeURIComponent(roomId)}`,
        { headers: { cookie, ...(origin ? { origin } : {}) } },
      );
      const messages: any[] = [];
      socket.on("error", reject);
      socket.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length === 1) resolve({ socket, messages });
      });
    });
  }

  async function waitFor(
    messages: any[],
    predicate: (message: any) => boolean,
    timeoutMs = 500,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = messages.find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("websocket message timeout");
  }

  async function closeSocket(socket: WebSocket): Promise<void> {
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    socket.close();
    await closed;
  }

  it("accepts only {playerCode}, rejects invalid codes, and returns only personal data", async () => {
    const invalid = await login("invalid");
    expect(invalid.status).toBe(401);
    expect(invalid.cookie).toBeUndefined();

    const passwordBody = await call("POST", "/api/auth/login", {
      playerCode: "TEST-A1",
      password: "obsolete",
    });
    expect(passwordBody.status).toBe(401);

    const valid = await login("TEST-A1");
    expect(valid.status).toBe(200);
    expect(valid.cookie).toMatch(/^labo_session=/);
    expect(valid.body).toEqual({
      player: { id: "A1", displayName: "Sujet A1", status: "actif" },
      access: { allowed: true, used: 0, remaining: 1 },
    });

    const me = await call("GET", "/api/me", undefined, valid.cookie);
    expect(me.body).toEqual(valid.body);
    expect(JSON.stringify(me.body)).not.toMatch(
      /TEST-|playerCode|password|admin|signature|dna|adn|[αβγδ]/i,
    );
  });

  it("rate limits login attempts per IP", async () => {
    expect((await login("bad")).status).toBe(401);
    expect((await login("bad")).status).toBe(401);
    expect((await login("bad")).status).toBe(401);
    expect((await login("TEST-A1")).status).toBe(429);
  });

  it("lets an active player reserve a canonical code without consuming it", async () => {
    const auth = await login("TEST-A1");
    const created = await createRoom(auth.cookie!);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      accessCode: "A1-B2",
      initiatorId: "A1",
      participants: [{ id: "A1" }],
      status: "WAITING",
    });
    expect(ledger.isConsumed("01")).toBe(false);
  });

  it("allows exactly one concurrent reservation for the same code", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const attempts = await Promise.all([
      createRoom(first.cookie!),
      createRoom(second.cookie!),
    ]);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([201, 403]);
    expect(ledger.isConsumed("01")).toBe(false);
  });

  it("releases a pre-analysis reservation on cancellation", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    expect((await call(
      "DELETE",
      `/api/incubations/${room.body.id}`,
      undefined,
      first.cookie,
    )).body.status).toBe("CANCELLED");
    expect((await createRoom(second.cookie!)).status).toBe(201);
    expect(ledger.isConsumed("01")).toBe(false);
  });

  it("releases a pre-analysis reservation on expiration", async () => {
    await replaceServer(ledger, {
      ...baseConfig,
      incubationTtlMs: 15,
      heartbeatMs: 5,
    });
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    await createRoom(first.cookie!);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect((await createRoom(second.cookie!)).status).toBe(201);
    expect(ledger.isConsumed("01")).toBe(false);
  });

  it("rejects empty and extra-field initiation payloads", async () => {
    const auth = await login("TEST-A1");
    expect((await call("POST", "/api/incubations", undefined, auth.cookie)).status).toBe(400);
    expect((await call(
      "POST",
      "/api/incubations",
      { accessCode: "A1-B2", subjectId: "A2" },
      auth.cookie,
    )).status).toBe(400);
  });

  it("refuses archived players but ignores the legacy personal counter", async () => {
    const archived = await login("TEST-D2");
    expect((await createRoom(archived.cookie!)).status).toBe(403);

    app.store.access.set("A3", { used: 1, remaining: 0 });
    const exhausted = await login("TEST-A3");
    expect((await createRoom(exhausted.cookie!, "C3-D4")).status).toBe(201);
  });

  it("joins by temporary code, caps rooms at two, and rate limits invalid codes", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const third = await login("TEST-A3");
    const room = await createRoom(first.cookie!);

    const joined = await call(
      "POST",
      "/api/incubations/join",
      { accessCode: room.body.accessCode },
      second.cookie,
    );
    expect(joined.status).toBe(200);
    expect(joined.body.participants.map((participant: any) => participant.id)).toEqual([
      "A1",
      "A2",
    ]);
    expect((await call(
      "POST",
      "/api/incubations/join",
      { accessCode: room.body.accessCode },
      third.cookie,
    )).status).toBe(409);

    expect((await call("POST", "/api/incubations/join", { accessCode: "XX-XX" }, third.cookie)).status)
      .toBe(404);
    const limited = await Promise.all(Array.from(
      { length: 8 },
      () => call("POST", "/api/incubations/join", { accessCode: "X1-X1" }, third.cookie),
    ));
    expect(limited.some((attempt) => attempt.status === 429)).toBe(true);
  });

  it("sends the same secret-free initial snapshot to two authenticated WebSockets", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);

    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);
    expect(firstWs.messages[0].snapshot).toEqual(secondWs.messages[0].snapshot);
    expect(JSON.stringify(firstWs.messages[0])).not.toMatch(
      /signature|allele|genotype|password|playerCode|dna|adn|[αβγδ]/i,
    );
    firstWs.socket.close();
    secondWs.socket.close();
  });

  it("rejects an authenticated foreign-origin WebSocket and accepts same-origin", async () => {
    const auth = await login("TEST-A1");
    const room = await createRoom(auth.cookie!);
    const websocketUrl =
      `ws://${address.address}:${address.port}/ws?incubationId=${encodeURIComponent(room.body.id)}`;
    const rejectedStatus = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(websocketUrl, {
        headers: {
          cookie: auth.cookie!,
          origin: "https://attacker.example",
        },
      });
      socket.once("open", () => reject(new Error("foreign origin unexpectedly connected")));
      socket.once("unexpected-response", (_request, response) => {
        response.resume();
        resolve(response.statusCode);
      });
      socket.once("error", () => undefined);
    });
    expect(rejectedStatus).toBe(401);

    const sameOrigin = `http://${address.address}:${address.port}`;
    const accepted = await connect(room.body.id, auth.cookie!, sameOrigin);
    expect(accepted.messages[0]).toMatchObject({
      type: "incubation.snapshot",
      snapshot: { id: room.body.id },
    });
    accepted.socket.close();
  });

  it("accepts bodyless identity-bound press/release and broadcasts sync, analysis, then result", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);
    const leftPath = `/api/incubations/${room.body.id}/chambers/left/fingerprint`;
    const rightPath = `/api/incubations/${room.body.id}/chambers/right/fingerprint`;

    expect((await call("POST", leftPath, undefined, first.cookie)).status).toBe(200);
    expect((await call("DELETE", leftPath, undefined, first.cookie)).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect((await call("POST", leftPath, undefined, first.cookie)).status).toBe(200);
    expect((await call("POST", rightPath, undefined, second.cookie)).status).toBe(200);

    await waitFor(firstWs.messages, (message) => message.snapshot.status === "SYNCING");
    const analyzing = await waitFor(
      firstWs.messages,
      (message) => message.snapshot.status === "ANALYZING",
    );
    expect(analyzing.snapshot).not.toHaveProperty("result");
    const resolved = await waitFor(
      firstWs.messages,
      (message) => message.snapshot.status === "RESOLVED",
    );
    expect(resolved.snapshot.result).toBe("M");
    expect(secondWs.messages.some((message) => message.snapshot.status === "RESOLVED")).toBe(true);
    firstWs.socket.close();
    secondWs.socket.close();
  });

  it("removes a departed participant and cancels their fingerprint after grace", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/left/fingerprint`,
      undefined,
      first.cookie,
    );
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/right/fingerprint`,
      undefined,
      second.cookie,
    );
    await closeSocket(secondWs.socket);

    const departure = await waitFor(
      firstWs.messages,
      (message) => message.event === "participant.left",
    );
    const snapshot = await call("GET", `/api/incubations/${room.body.id}`, undefined, first.cookie);
    expect(snapshot.body.status).toBe("ONE_FINGERPRINT");
    expect(snapshot.body.participants.map((participant: any) => participant.id)).toEqual([
      "A1",
    ]);
    expect(departure.snapshot.participants).toHaveLength(1);
    expect(departure.snapshot.chambers.right.pressed).toBe(false);
    expect(app.store.access.get("A1")).toEqual({ used: 0, remaining: 1 });
    firstWs.socket.close();
  });

  it("keeps presence stable when a participant reconnects within grace", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);
    const eventOffset = firstWs.messages.length;

    await closeSocket(secondWs.socket);
    const reconnected = await connect(room.body.id, second.cookie!);
    await new Promise((resolve) => setTimeout(resolve, 60));

    const snapshot = await call("GET", `/api/incubations/${room.body.id}`, undefined, first.cookie);
    expect(snapshot.body.participants).toHaveLength(2);
    expect(firstWs.messages.slice(eventOffset).some(
      (message) => message.event === "participant.left",
    )).toBe(false);
    firstWs.socket.close();
    reconnected.socket.close();
  });

  it("keeps an initiator room joinable across fingerprint grace until presence grace expires", async () => {
    await replaceServer(ledger, {
      ...baseConfig,
      disconnectGraceMs: 10,
      participantDisconnectGraceMs: 100,
    });
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    const firstWs = await connect(room.body.id, first.cookie!);

    await closeSocket(firstWs.socket);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const joined = await call(
      "POST",
      "/api/incubations/join",
      { accessCode: room.body.accessCode },
      second.cookie,
    );
    expect(joined.status).toBe(200);
    expect(joined.body.participants.map((participant: any) => participant.id)).toEqual([
      "A1",
      "A2",
    ]);

    const secondWs = await connect(room.body.id, second.cookie!);
    const reconnected = await connect(room.body.id, first.cookie!);
    await new Promise((resolve) => setTimeout(resolve, 120));

    const restored = await call(
      "GET",
      `/api/incubations/${room.body.id}`,
      undefined,
      first.cookie,
    );
    expect(restored.status).toBe(200);
    expect(restored.body.participants.map((participant: any) => participant.id)).toEqual([
      "A1",
      "A2",
    ]);

    await closeSocket(reconnected.socket);
    await waitFor(
      secondWs.messages,
      (message) => message.snapshot.status === "CANCELLED",
    );
    expect((await call(
      "POST",
      "/api/incubations/join",
      { accessCode: room.body.accessCode },
      second.cookie,
    )).status).toBe(404);
    expect((await call(
      "GET",
      `/api/incubations/${room.body.id}`,
      undefined,
      second.cookie,
    )).status).toBe(404);
    expect(ledger.isConsumed("01")).toBe(false);
    expect((await createRoom(second.cookie!)).status).toBe(201);
    secondWs.socket.close();
  });

  it("allows a departed participant to join the room again by code", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);

    await closeSocket(secondWs.socket);
    await waitFor(firstWs.messages, (message) => message.event === "participant.left");
    const rejoined = await call(
      "POST",
      "/api/incubations/join",
      { accessCode: room.body.accessCode },
      second.cookie,
    );

    expect(rejoined.status).toBe(200);
    expect(rejoined.body.participants.map((participant: any) => participant.id)).toEqual([
      "A1",
      "A2",
    ]);
    expect(firstWs.messages.some((message) => message.event === "participant.joined")).toBe(true);
    firstWs.socket.close();
  });

  it("cancels an abandoned initiator room and releases its grant reservation", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);

    await closeSocket(firstWs.socket);
    const cancelled = await waitFor(
      secondWs.messages,
      (message) => message.snapshot.status === "CANCELLED",
    );

    expect(cancelled.snapshot.participants.map((participant: any) => participant.id)).toEqual([
      "A2",
    ]);
    expect(ledger.isConsumed("01")).toBe(false);
    expect((await createRoom(second.cookie!)).status).toBe(201);
    secondWs.socket.close();
  });

  it("never exceeds two participants when joins race for a freed slot", async () => {
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const third = await login("TEST-A3");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);

    await closeSocket(secondWs.socket);
    await waitFor(firstWs.messages, (message) => message.event === "participant.left");
    const attempts = await Promise.all([
      call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie),
      call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, third.cookie),
    ]);

    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([200, 409]);
    const winner = attempts.find((attempt) => attempt.status === 200)!;
    expect(winner.body.participants).toHaveLength(2);
    const snapshot = await call("GET", `/api/incubations/${room.body.id}`, undefined, first.cookie);
    expect(snapshot.body.participants).toHaveLength(2);
    firstWs.socket.close();
  });

  it("consumes initiator access exactly once after double validation", async () => {
    const trackedLedger = createMemoryAccessGrantLedger();
    let consumeCalls = 0;
    ledger = {
      isConsumed: (accessGrantId) => trackedLedger.isConsumed(accessGrantId),
      consume(accessGrantId) {
        consumeCalls += 1;
        return trackedLedger.consume(accessGrantId);
      },
    };
    await replaceServer(ledger);
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/left/fingerprint`,
      undefined,
      first.cookie,
    );
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/right/fingerprint`,
      undefined,
      second.cookie,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(ledger.isConsumed("01")).toBe(true);
    expect(consumeCalls).toBe(1);
    expect(app.store.access.get("A1")).toEqual({ used: 0, remaining: 1 });
    expect(app.store.runs).toHaveLength(1);
  });

  it("keeps the grant reserved through every pre-analysis state and consumes it once at ANALYZING", async () => {
    const trackedLedger = createMemoryAccessGrantLedger();
    let consumeCalls = 0;
    ledger = {
      isConsumed: (accessGrantId) => trackedLedger.isConsumed(accessGrantId),
      consume(accessGrantId) {
        consumeCalls += 1;
        return trackedLedger.consume(accessGrantId);
      },
    };
    await replaceServer(ledger, {
      ...baseConfig,
      syncDurationMs: 35,
      disconnectGraceMs: 10,
      analysisDurationMs: 20,
    });
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    expect(first.cookie).not.toBe(second.cookie);

    const room = await createRoom(first.cookie!);
    expect(ledger.isConsumed("01")).toBe(false);
    expect(consumeCalls).toBe(0);

    const joined = await call(
      "POST",
      "/api/incubations/join",
      { accessCode: room.body.accessCode },
      second.cookie,
    );
    expect(joined.body.participants).toHaveLength(2);
    expect(ledger.isConsumed("01")).toBe(false);

    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);
    const leftPath = `/api/incubations/${room.body.id}/chambers/left/fingerprint`;
    const rightPath = `/api/incubations/${room.body.id}/chambers/right/fingerprint`;

    const pressedAlone = await call("POST", leftPath, undefined, first.cookie);
    expect(pressedAlone.body.status).toBe("ONE_FINGERPRINT");
    expect(ledger.isConsumed("01")).toBe(false);

    expect((await call("POST", rightPath, undefined, second.cookie)).body.status).toBe("SYNCING");
    expect(ledger.isConsumed("01")).toBe(false);
    await call("DELETE", rightPath, undefined, second.cookie);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await call(
      "GET",
      `/api/incubations/${room.body.id}`,
      undefined,
      first.cookie,
    )).body.status).toBe("ONE_FINGERPRINT");
    expect(ledger.isConsumed("01")).toBe(false);
    expect(consumeCalls).toBe(0);

    await call("POST", rightPath, undefined, second.cookie);
    const analyzing = await waitFor(
      firstWs.messages,
      (message) => message.snapshot.status === "ANALYZING",
    );
    expect(analyzing.snapshot).not.toHaveProperty("result");
    expect(ledger.isConsumed("01")).toBe(true);
    expect(consumeCalls).toBe(1);

    const resolved = await waitFor(
      secondWs.messages,
      (message) => message.snapshot.status === "RESOLVED",
    );
    expect(resolved.snapshot.result).toBe("M");
    expect(app.store.runs).toHaveLength(1);
    expect(consumeCalls).toBe(1);

    const third = await login("TEST-A3");
    expect((await createRoom(third.cookie!)).status).toBe(403);
    firstWs.socket.close();
    secondWs.socket.close();
  });

  it("lets an analysis resolve when its pre-analysis TTL expires", async () => {
    const trackedLedger = createMemoryAccessGrantLedger();
    let consumeCalls = 0;
    ledger = {
      isConsumed: (accessGrantId) => trackedLedger.isConsumed(accessGrantId),
      consume(accessGrantId) {
        consumeCalls += 1;
        return trackedLedger.consume(accessGrantId);
      },
    };
    await replaceServer(ledger, {
      ...baseConfig,
      incubationTtlMs: 250,
      syncDurationMs: 10,
      analysisDurationMs: 500,
      heartbeatMs: 100,
    });
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: room.body.accessCode }, second.cookie);
    const firstWs = await connect(room.body.id, first.cookie!);
    const secondWs = await connect(room.body.id, second.cookie!);

    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/left/fingerprint`,
      undefined,
      first.cookie,
    );
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/right/fingerprint`,
      undefined,
      second.cookie,
    );
    await waitFor(firstWs.messages, (message) => message.snapshot.status === "ANALYZING");
    expect(ledger.isConsumed("01")).toBe(true);

    const resolved = await waitFor(
      firstWs.messages,
      (message) => message.snapshot.status === "RESOLVED",
      1_000,
    );
    expect(resolved.snapshot.result).toBe("M");
    expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(room.body.expiresAt));
    expect(consumeCalls).toBe(1);
    expect(app.store.runs).toHaveLength(1);
    firstWs.socket.close();
    secondWs.socket.close();
  });

  it("keeps a consumed code unavailable after a file-ledger restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "labo-node-ledger-"));
    temporaryDirectories.push(directory);
    const ledgerPath = join(directory, "ledger.json");
    await replaceServer(createFileAccessGrantLedger(ledgerPath));
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: "A1-B2" }, second.cookie);
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/left/fingerprint`,
      undefined,
      first.cookie,
    );
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/right/fingerprint`,
      undefined,
      second.cookie,
    );
    await new Promise((resolve) => setTimeout(resolve, 60));

    await replaceServer(createFileAccessGrantLedger(ledgerPath));
    const restarted = await login("TEST-A3");
    expect((await createRoom(restarted.cookie!)).status).toBe(403);
  });

  it("cancels with no run when durable grant consumption fails", async () => {
    await replaceServer({
      isConsumed: () => false,
      consume: () => {
        throw new Error("disk_failure");
      },
    });
    const first = await login("TEST-A1");
    const second = await login("TEST-A2");
    const room = await createRoom(first.cookie!);
    await call("POST", "/api/incubations/join", { accessCode: "A1-B2" }, second.cookie);
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/left/fingerprint`,
      undefined,
      first.cookie,
    );
    await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/right/fingerprint`,
      undefined,
      second.cookie,
    );
    await new Promise((resolve) => setTimeout(resolve, 60));

    const snapshot = await call(
      "GET",
      `/api/incubations/${room.body.id}`,
      undefined,
      first.cookie,
    );
    expect(snapshot.body.status).toBe("CANCELLED");
    expect(app.store.runs).toHaveLength(0);
  });

  it("does not consume a pre-analysis reservation during shutdown", async () => {
    const first = await login("TEST-A1");
    await createRoom(first.cookie!);
    await replaceServer(ledger);
    expect(ledger.isConsumed("01")).toBe(false);
  });

  it("denies non-participants and client-supplied identities without leaking secrets", async () => {
    const first = await login("TEST-A1");
    const outsider = await login("TEST-A3");
    const room = await createRoom(first.cookie!);
    expect((await call(
      "GET",
      `/api/incubations/${room.body.id}`,
      undefined,
      outsider.cookie,
    )).status).toBe(404);
    const injected = await call(
      "POST",
      `/api/incubations/${room.body.id}/chambers/left/fingerprint`,
      { subjectId: "A3", result: "1", access: 999 },
      first.cookie,
    );
    expect(injected.status).toBe(400);
    expect(JSON.stringify(injected.body)).not.toMatch(
      /A3|signature|allele|genotype|password|dna|adn|[αβγδ]/i,
    );
  });
});
