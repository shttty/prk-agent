import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { exactKeys } from "../request/inspect-request-keys.ts";
import { restartGatewayUnit } from "./restart-unit.ts";
import { responseJson } from "../responses/write-json.ts";

export async function handleRestartRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { http, gatewayRestart } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const body = await readJsonBody(http, request);
      if (!exactKeys(body, [])) throw new HttpError(400, "Gateway restart accepts exactly {}.");
      if (!gatewayRestart.unit) throw new HttpError(409, "Gateway restart is not configured; set gateway.systemdUnit in config.toml.", "NOT_CONFIGURED");
      const result = await restartGatewayUnit({ unit: gatewayRestart.unit, timeoutMs: gatewayRestart.timeoutMs });
      if (result.status === "restarted") { responseJson(http, response, 200, { unit: result.unit, restarted: true, output: result.output }); return; }
      if (result.status === "timeout") throw new HttpError(504, "systemctl did not finish before the deadline; the restart outcome is unknown.", "SYSTEMCTL_TIMEOUT", { unit: result.unit, output: result.output });
      throw new HttpError(502, `systemctl restart failed${result.output ? `: ${result.output}` : "."}`, "SYSTEMCTL_FAILED", { unit: result.unit, exitCode: result.exitCode, output: result.output });
    
}
