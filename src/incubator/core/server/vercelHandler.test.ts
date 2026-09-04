import { afterEach, describe, expect, it } from "vitest";
import vercelHandler from "./vercelHandler";

const globalForLabo = globalThis as typeof globalThis & {
  __laboIncubatorServer?: { close(): Promise<void> };
};

const previousVercel = process.env.VERCEL;
const previousPattern = process.env.D14_PATTERN;
const previousHost = process.env.D14_HOST;

afterEach(async () => {
  const app = globalForLabo.__laboIncubatorServer;
  globalForLabo.__laboIncubatorServer = undefined;
  await app?.close();
  if (previousVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercel;
  if (previousPattern === undefined) delete process.env.D14_PATTERN;
  else process.env.D14_PATTERN = previousPattern;
  if (previousHost === undefined) delete process.env.D14_HOST;
  else process.env.D14_HOST = previousHost;
});

describe("Vercel incubator adapter", () => {
  it("answers GET /api/me as unauthorized", async () => {
    process.env.VERCEL = "1";
    const response = await vercelHandler(new Request("http://localhost/api/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "request_denied" });
  });

  it("keeps login on POST /api/auth/login", async () => {
    process.env.VERCEL = "1";
    const response = await vercelHandler(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerCode: "nope" }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "request_denied" });
  });

  it("keeps nested incubation routes", async () => {
    process.env.VERCEL = "1";
    const join = await vercelHandler(new Request("http://localhost/api/incubations/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "A1-B2" }),
    }));
    expect(join.status).toBe(401);
    const room = await vercelHandler(new Request("http://localhost/api/incubations/room-1"));
    expect(room.status).toBe(401);
    const finger = await vercelHandler(new Request(
      "http://localhost/api/incubations/room-1/chambers/left/fingerprint",
      { method: "POST" },
    ));
    expect(finger.status).toBe(401);
  });

  it("answers POST /api/validate-pattern without unlocking on a miss", async () => {
    process.env.VERCEL = "1";
    process.env.D14_PATTERN = "1,2,3";
    const miss = await vercelHandler(new Request("http://localhost/api/validate-pattern", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern: [0, 1] }),
    }));
    const hit = await vercelHandler(new Request("http://localhost/api/validate-pattern", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern: [1, 2, 3] }),
    }));
    expect(await miss.json()).toEqual({ ok: false });
    expect(await hit.json()).toEqual({ ok: true });
  });

  it("answers POST /api/validate-host after normalizing the hostname", async () => {
    process.env.VERCEL = "1";
    process.env.D14_HOST = "example-host";
    const miss = await vercelHandler(new Request("http://localhost/api/validate-host", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host: "other" }),
    }));
    const hit = await vercelHandler(new Request("http://localhost/api/validate-host", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host: " Example-Host " }),
    }));
    expect(await miss.json()).toEqual({ ok: false });
    expect(await hit.json()).toEqual({ ok: true });
  });

  it("recovers the public API path after a Vercel rewrite to /api", async () => {
    process.env.VERCEL = "1";
    const rewritten = new Request("http://localhost/api?__labo_path=/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerCode: "nope" }),
    });
    const response = await vercelHandler(rewritten);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "request_denied" });
  });
});
