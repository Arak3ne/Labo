import { handleValidateHost, handleValidatePattern } from "../../../prologue/d14/server/d14Validate.js";
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
  const fromQuery = url.searchParams.get("__labo_path");
  const forwarded = readForwardedApiPath(request);
  let pathname = (fromQuery?.startsWith("/api") ? fromQuery : undefined) ?? forwarded ?? url.pathname;
  url.searchParams.delete("__labo_path");
  if (pathname === "/api/index" || pathname === "/api/index.js") {
    pathname = forwarded && forwarded.startsWith("/api/") ? forwarded : "/api";
  }
  if (!pathname.startsWith("/api/") && pathname !== "/api") {
    pathname = pathname.startsWith("/") ? `/api${pathname}` : `/api/${pathname}`;
  }
  if (pathname === url.pathname && !fromQuery) return request;
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
    const pubReq = withPublicApiPath(request);
    const url = new URL(pubReq.url);
    
    if (url.pathname === "/api/validate-pattern") {
      return handleValidatePattern(pubReq);
    }
    if (url.pathname === "/api/validate-host") {
      return handleValidateHost(pubReq);
    }

    // Interception pour les réponses du Prologue (D-07)
    if (pubReq.method === "POST" && url.pathname === "/api/d07-submit") {
      const data = (await pubReq.json().catch(() => ({}))) as any;
      
      // Si un Webhook Discord est configuré, on envoie les réponses
      if (process.env.DISCORD_WEBHOOK_URL) {
        const content = `**Nouvelle soumission D-07**\nSujet: \`${data.subjectId}\`\n\`\`\`json\n${JSON.stringify(data.answers, null, 2)}\n\`\`\``;
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        }).catch(err => console.error("Discord Webhook Error:", err));
      } else {
        // En attendant d'avoir un webhook, on log juste sur Vercel
        console.log("D07 Answers received:", data);
      }
      return Response.json({ success: true });
    }

    return await getIncubatorServer().dispatchWeb(pubReq);
  } catch (error) {
    console.error("[labo-api]", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
