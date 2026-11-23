import type { RemoteExtensionGeneration } from "../../generation/generation-types.ts";
import type { LoadContext } from "../load-types.ts";
import { publish } from "./publish-status.ts";

export function recordGeneration(ctx: LoadContext, generation: RemoteExtensionGeneration): void {
        for (const [name, status] of ctx.remoteStatuses) {
          const registration = generation.registration?.packages.find((pkg) => pkg.name === name);
          status.generation = generation.generation;
          status.pid = generation.registration?.pid;
          status.tools = registration?.tools;
          status.commands = registration?.commands;
          status.error = registration?.error;
          status.errorCode = registration?.errorCode;
          status.errorDetails = registration?.errorDetails;
          status.providerErrors = registration?.providerErrors;
          for (const tool of status.tools ?? []) ctx.tools.set(tool.name, status);
          ctx.input.onRemoteExtensionGeneration?.(generation, { instance: ctx.input.target.id, package: name, ...(ctx.input.sessionId === undefined ? {} : { sessionId: ctx.input.sessionId }) });
        }
        publish(ctx);
}
