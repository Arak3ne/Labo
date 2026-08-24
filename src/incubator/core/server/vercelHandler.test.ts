import { afterEach, describe, expect, it } from "vitest";
import vercelHandler from "./vercelHandler";

const globalForLabo = globalThis as typeof globalThis & {
  __laboIncubatorServer?: { close(): Promise<void> };
};

const previousVercel = process.env.VERCEL;

afterEach(async () => {
  const app = globalForLabo.__laboIncubatorServer;
  globalForLabo.__laboIncubatorServer = undefined;
  await app?.close();
  if (previousVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercel;
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

  it("recovers the public API path after a Vercel rewrite to /api", async () => {
    process.env.VERCEL = "1";
    const rewritten = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-uri": "/api/auth/login",
      },
      body: JSON.stringify({ playerCode: "nope" }),
    });
    const response = await vercelHandler(rewritten);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "request_denied" });
  });
});
