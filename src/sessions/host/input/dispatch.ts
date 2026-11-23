import type { ImageContent } from "@earendil-works/pi-ai";
import type { PromptOptions } from "@earendil-works/pi-coding-agent";
import type { HostContext, Operation, SubmitMessageRequest } from "../host-types.ts";

export function dispatch(ctx: HostContext, operation: Operation, request: SubmitMessageRequest, peerPreflight: PromptOptions["preflightResult"], queued: boolean, images: ImageContent[] | undefined): Promise<unknown> {
  if (operation.cancelled) throw new Error("Input was cancelled before SDK dispatch.");
  if (peerPreflight) return ctx.session.prompt(request.message, {
    source: "extension",
    expandPromptTemplates: false,
    preflightResult: peerPreflight,
    ...(queued ? { streamingBehavior: request.queue ?? "steer" } : {}),
  });
  if (request.internalNotification !== undefined) return ctx.session.sendCustomMessage({
    customType: "gateway-internal-notification", content: request.message, display: false,
    details: request.internalNotification,
  }, { triggerTurn: true, deliverAs: "followUp" });
  if (queued && request.queue === "steer") return ctx.session.steer(request.message, images);
  if (queued && request.queue === "followUp") return ctx.session.followUp(request.message, images);
  return ctx.session.prompt(request.message, {
    expandPromptTemplates: ctx.sessionOptions.hostExpandPromptTemplates,
    ...(images === undefined ? {} : { images }),
  } satisfies PromptOptions);
}
