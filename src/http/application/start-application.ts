import type { WebApplicationOptions } from "./application-types.ts";
import { resolvePrkHome } from "../../config/home/resolve-prk-home.ts";
import { loadPrkConfig } from "../../config/document/load-prk-config.ts";
import { DEFAULT_HTTP_OPTIONS } from "../../config/http/http-options.ts";
import { validateWebAddress } from "../request/validate-web-address.ts";
import { connectWebGateway } from "../gateway-connection/connect-gateway.ts";
import type { WebServer } from "../listener/listener-types.ts";
import { startWebServer } from "../listener/start-listener.ts";
import { assembleApplication } from "./assemble-application.ts";

export async function startWebApplication(options: WebApplicationOptions) {
  const home = resolvePrkHome(options.home);
  const config = options.artifacts && options.gateway ? undefined : await loadPrkConfig(home);
  const artifacts = options.artifacts ?? config!.artifacts;
  const restart = options.gateway ?? config!.gateway;
  const http = options.http ?? DEFAULT_HTTP_OPTIONS;
  const host = options.host ?? http.host;
  const port = options.port ?? http.port;
  validateWebAddress(host, port);
  const gateway = await connectWebGateway({ socket: options.socket, gateway: options.gateway, http, limits: options.limits });
  let server: WebServer;
  try {
    server = await startWebServer(gateway, { host, port, http, limits: options.limits, home, artifacts, gatewayRestart: { unit: restart.systemdUnit, timeoutMs: restart.restartTimeoutMs } });
  } catch (error) {
    try {
      await gateway.close();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], "Web startup and owned client cleanup failed.");
    }
    throw error;
  }
  return assembleApplication(server, gateway);
}
