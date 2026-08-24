import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createIncubatorNodeServer,
  loadIncubatorServerConfig,
  type IncubatorNodeServer,
} from "./nodeServer";

const globalForLabo = globalThis as typeof globalThis & {
  __laboIncubatorServer?: IncubatorNodeServer;
};

export function vercelRequestUrl(request: IncomingMessage): string {
  const raw = request.url ?? "/";
  try {
    const url = new URL(raw, "http://localhost");
    if (url.pathname === "/ws" || url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return raw;
    }
    const prefix = url.pathname === "/" ? "/api" : `/api${url.pathname}`;
    return `${prefix}${url.search}`;
  } catch {
    return raw;
  }
}

export function getIncubatorServer(): IncubatorNodeServer {
  if (!globalForLabo.__laboIncubatorServer) {
    globalForLabo.__laboIncubatorServer = createIncubatorNodeServer({
      config: loadIncubatorServerConfig(),
    });
  }
  return globalForLabo.__laboIncubatorServer;
}

export default async function vercelHandler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const original = request.url;
  request.url = vercelRequestUrl(request);
  try {
    await getIncubatorServer().dispatch(request, response);
  } finally {
    request.url = original;
  }
}
