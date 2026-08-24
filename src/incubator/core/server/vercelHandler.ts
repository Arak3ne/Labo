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

export default async function vercelHandler(request: Request): Promise<Response> {
  try {
    return await getIncubatorServer().dispatchWeb(request);
  } catch (error) {
    console.error("[labo-api]", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
