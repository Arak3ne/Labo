import { createMemoryAccessGrantLedger } from "./accessGrantLedger.js";
import {
  createIncubatorNodeServer,
  loadIncubatorServerConfig,
  type IncubatorNodeServer,
} from "./nodeServer.js";

const globalForLabo = globalThis as typeof globalThis & {
  __laboIncubatorServer?: IncubatorNodeServer;
};

export function getIncubatorServer(): IncubatorNodeServer {
  if (!globalForLabo.__laboIncubatorServer) {
    const config = loadIncubatorServerConfig();
    globalForLabo.__laboIncubatorServer = createIncubatorNodeServer({
      config,
      ...(process.env.VERCEL ? { accessGrantLedger: createMemoryAccessGrantLedger() } : {}),
    });
  }
  return globalForLabo.__laboIncubatorServer;
}

export function withPublicApiPath(request: Request): Request {
  const url = new URL(request.url);
  const forwarded = readForwardedApiPath(request);
  let pathname = forwarded ?? url.pathname;
  if (pathname === "/api/index" || pathname === "/api/index.js") {
    pathname = forwarded && forwarded.startsWith("/api/") ? forwarded : "/api";
  }
  if (!pathname.startsWith("/api/") && pathname !== "/api") {
    pathname = pathname.startsWith("/") ? `/api${pathname}` : `/api/${pathname}`;
  }
  if (pathname === url.pathname) return request;
  url.pathname = pathname;
  return new Request(url, request);
}

function readForwardedApiPath(request: Request): string | undefined {
  for (const name of ["x-forwarded-uri", "x-invoke-path", "x-original-uri"] as const) {
    const raw = request.headers.get(name);
    if (!raw) continue;
    try {
      const path = raw.startsWith("http") ? new URL(raw).pathname : raw.split("?")[0];
      if (path?.startsWith("/api/") || path === "/api") return path;
    } catch {
      // Ignore malformed forwarded paths and keep the request URL.
    }
  }
  return undefined;
}

export default async function vercelHandler(request: Request): Promise<Response> {
  try {
    return await getIncubatorServer().dispatchWeb(withPublicApiPath(request));
  } catch (error) {
    console.error("[labo-api]", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
