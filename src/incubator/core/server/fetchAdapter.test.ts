import { describe, expect, it } from "vitest";
import { incomingFromFetch, isFetchRequest } from "./fetchAdapter";

describe("fetch adapter", () => {
  it("recognizes a web Request without instanceof", () => {
    expect(isFetchRequest(new Request("http://localhost/api/me"))).toBe(true);
    expect(isFetchRequest({ url: "/api/me", headers: {} })).toBe(false);
  });

  it("does not wait for GET bodies", async () => {
    const incoming = await incomingFromFetch({
      method: "GET",
      url: "https://labo.example/api/me?x=1",
      headers: new Headers({ "x-forwarded-for": "203.0.113.8" }),
      arrayBuffer: () => new Promise(() => {}),
    } as Request);
    expect(incoming.method).toBe("GET");
    expect(incoming.url).toBe("/api/me?x=1");
    expect(incoming.headers.host).toBe("labo.example");
    expect(incoming.socket.remoteAddress).toBe("203.0.113.8");
  });
});
