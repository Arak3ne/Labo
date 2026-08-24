import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { vercelRequestUrl } from "./vercelHandler";

function req(url: string): IncomingMessage {
  return { url } as IncomingMessage;
}

describe("Vercel incubator adapter", () => {
  it("keeps already-prefixed API paths", () => {
    expect(vercelRequestUrl(req("/api/me"))).toBe("/api/me");
    expect(vercelRequestUrl(req("/api/auth/login?x=1"))).toBe("/api/auth/login?x=1");
  });

  it("prefixes stripped function paths", () => {
    expect(vercelRequestUrl(req("/me"))).toBe("/api/me");
    expect(vercelRequestUrl(req("/auth/login"))).toBe("/api/auth/login");
    expect(vercelRequestUrl(req("/"))).toBe("/api");
  });
});
