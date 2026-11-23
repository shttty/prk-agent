import { readFileSync } from "node:fs";

export function buildGatewayBridge(): string {
  return readFileSync(new URL("./bridge/create_gateway.py", import.meta.url), "utf8");
}
