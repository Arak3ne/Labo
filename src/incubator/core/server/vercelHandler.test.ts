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
});
