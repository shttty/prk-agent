import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { WireError } from "../../wire/create-error.ts";
import { loadPrkConfig } from "../../../config/document/load-prk-config.ts";
import { resolvePrkHome } from "../../../config/home/resolve-prk-home.ts";
import type { GatewayCommandContext } from "../command-state.ts";
import { stop as stopGateway } from "./stop.ts";

export async function gateway(args: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: {
    socket: { type: "string" }, model: { type: "string" },
    home: { type: "string" }, extension: { type: "string", multiple: true },
    "no-skills": { type: "boolean" },
  } });
  if (!values.model) throw new WireError("CLI_ERROR", "Gateway requires --model PROVIDER/MODEL for its sessions.");
  const home = resolvePrkHome(values.home);
  const config = await loadPrkConfig(home);
  // Lazy imports: attach never initializes SDK resources, providers or an Agent.
  const { createGatewayHost } = await import("../../host/start-host.ts");
  const { startGateway } = await import("../../socket-server/start-listener.ts");
  const { startMetricsListener, METRICS_HOST } = await import("../../../metrics/endpoint/start-metrics-listener.ts");
  const host = await createGatewayHost({
    cwd: process.cwd(),
    home, config,
    model: values.model,
    ...(values.extension ? { extensionPaths: values.extension.map((path) => resolve(path)) } : {}),
    ...(values["no-skills"] ? { noSkills: true } : {}),
  });
  const ctx: GatewayCommandContext = { endpoint: undefined };
  let metrics: Awaited<ReturnType<typeof startMetricsListener>> | undefined;
  const stop = () => stopGateway(ctx);
  try {
    if (config.metrics.enabled) metrics = await startMetricsListener(config.metrics.port);
    ctx.endpoint = await startGateway(host, values.socket ?? config.gateway.socketPath, config.gateway, config.limits);
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    console.error(`[${new Date().toISOString()}] Gateway ready; owns sessions on private local transport v1.`);
    if (metrics) console.error(`[${new Date().toISOString()}] Gateway metrics on http://${METRICS_HOST}:${metrics.port}/metrics`);
    await ctx.endpoint.closed;
  } finally {
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    await host.close();
    await metrics?.close();
  }
}
