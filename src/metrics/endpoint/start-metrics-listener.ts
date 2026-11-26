import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gatewayRegistry } from "../registry/gateway-registry.ts";

export const METRICS_HOST = "127.0.0.1";

/** Read-only text endpoint for Prometheus. The host is fixed to loopback and has no setting. */
export async function startMetricsListener(port: number): Promise<{ readonly address: string; readonly port: number; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.url?.split("?")[0] !== "/metrics") { response.writeHead(404).end(); return; }
    if (request.method !== "GET") { response.writeHead(405, { Allow: "GET" }).end(); return; }
    gatewayRegistry.metrics().then((body) => {
      response.writeHead(200, { "Content-Type": gatewayRegistry.contentType }).end(body);
    }, (error: unknown) => {
      console.error(`[${new Date().toISOString()}] Gateway metrics collection failed`, error);
      response.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, METRICS_HOST, () => { server.removeListener("error", reject); resolve(); });
  });
  const bound = server.address() as AddressInfo;
  return {
    address: bound.address, port: bound.port,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}
