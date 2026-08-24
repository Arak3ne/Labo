import type { IncomingMessage, ServerResponse } from "node:http";
import { createMemoryAccessGrantLedger } from "./accessGrantLedger";
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
    const config = loadIncubatorServerConfig();
    globalForLabo.__laboIncubatorServer = createIncubatorNodeServer({
      config,
      ...(process.env.VERCEL ? { accessGrantLedger: createMemoryAccessGrantLedger() } : {}),
    });
  }
  return globalForLabo.__laboIncubatorServer;
}

function isFetchRequest(value: unknown): value is Request {
  return typeof Request !== "undefined" && value instanceof Request;
}

export default async function vercelHandler(
  request: Request | IncomingMessage,
  response?: ServerResponse,
): Promise<Response | void> {
  const app = getIncubatorServer();
  try {
    if (response && !isFetchRequest(request)) {
      request.url = vercelRequestUrl(request);
      await app.dispatch(request, response);
      return;
    }
    if (isFetchRequest(request)) {
      return await app.dispatchWeb(request);
    }
    request.url = vercelRequestUrl(request);
    return await app.dispatchWeb(
      new Request(`http://${request.headers.host ?? "localhost"}${request.url}`, {
        method: request.method ?? "GET",
      }),
    );
  } catch (error) {
    console.error("[labo-api]", error);
    if (response && !response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "internal_error" }));
      return;
    }
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
