import { parseArgs } from "node:util";
import { WireError } from "../../wire/create-error.ts";
import { loadPrkConfig } from "../../../config/document/load-prk-config.ts";
import { resolvePrkHome } from "../../../config/home/resolve-prk-home.ts";
import type { WebCommandContext } from "../command-state.ts";
import { stop as stopWeb } from "./stop.ts";

export async function web(args: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: {
    home: { type: "string" }, socket: { type: "string" },
    host: { type: "string" }, port: { type: "string" },
  } });
  const home = resolvePrkHome(values.home);
  const config = await loadPrkConfig(home);
  const port = values.port === undefined ? config.http.port : Number(values.port);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) throw new WireError("CLI_ERROR", "Web port must be an integer from 0 to 65535.");
  const { startWebApplication } = await import("../../../http/application/start-application.ts");
  const application = await startWebApplication({ socket: values.socket ?? config.gateway.socketPath, host: values.host ?? config.http.host, port,
    home, artifacts: config.artifacts, gateway: config.gateway, http: config.http, limits: config.limits });
  const ctx: WebCommandContext = { application };
  const stop = () => stopWeb(ctx);
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  try {
    console.error(`[${new Date().toISOString()}] Web client ready at ${application.server.url}; Gateway owns the sessions.`);
    await application.closed;
  } finally {
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    await application.close();
  }
}
