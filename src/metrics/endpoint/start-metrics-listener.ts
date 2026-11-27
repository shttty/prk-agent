import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gatewayRegistry } from "../registry/gateway-registry.ts";

export interface MetricsListener {
  readonly address: string;
  readonly port: number;
  /** Where a scraper reaches it: the bound address as written (an IPv6 literal in brackets) and port. */
  readonly url: string;
  close(): Promise<void>;
}

/** Read-only text endpoint for Prometheus on one IP literal (the default is loopback). */
export async function startMetricsListener(host: string, port: number): Promise<MetricsListener> {
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
    server.listen(port, host, () => { server.removeListener("error", reject); resolve(); });
  });
  const bound = server.address() as AddressInfo;
  return {
    address: bound.address, port: bound.port, url: `http://${bound.family === "IPv6" ? `[${bound.address}]` : bound.address}:${bound.port}/metrics`,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}
