import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { createSessionRequest } from "./lifecycle/parse-create-request.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";
import { object } from "../../gateway/wire/is-record.ts";
import { responseJson } from "../responses/write-json.ts";

export async function createSession(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const body = await readJsonBody(http, request);
      const { target, ...options } = createSessionRequest(limits, body);
      let created: unknown;
      try {
        created = await gateway.call("createSession", {
          target,
          ...(options.label === undefined ? {} : { label: options.label }),
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          ...(options.project === undefined ? {} : { project: options.project }),
        });
      } catch (error: unknown) {
        throw gatewayFailure(error, "Session could not be created by the Gateway; no local session was started.");
      }
      if (!object(created) || !object(created.session) || !object(created.snapshot)) {
        throw new HttpError(503, "Gateway did not return a created session; inspect the session list before retrying.");
      }
      responseJson(http, response, 201, { session: created.session, snapshot: created.snapshot });
      return;
    
}
