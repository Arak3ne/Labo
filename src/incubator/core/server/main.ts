import { createIncubatorNodeServer, loadIncubatorServerConfig } from "./nodeServer";

const port = Number(process.env.LABO_SERVER_PORT ?? 8787);
const host = process.env.LABO_SERVER_HOST ?? "127.0.0.1";
const app = createIncubatorNodeServer({ config: loadIncubatorServerConfig() });

const address = await app.listen(port, host);
console.log(`Incubator server listening on http://${address.address}:${address.port}`);

async function shutdown(): Promise<void> {
  await app.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
