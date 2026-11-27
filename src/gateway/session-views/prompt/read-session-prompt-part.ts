import { WireError } from "../../wire/create-error.ts";
import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import { listPromptTools } from "../../../sessions/prompt-capture/list-prompt-tools.ts";
import { pagePromptMessages } from "../../../sessions/prompt-capture/page-prompt-messages.ts";
import { PROMPT_PAGE_DEFAULT } from "../../../sessions/prompt-capture/prompt-part-constants.ts";

/** One part of the latest captured request, whole. Like `sessionPrompt` it only reads the live runtime and never wakes a session. */
export function sessionPromptPart(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["sessionPromptPart"]>[0], request: Parameters<GatewaySessionHost["sessionPromptPart"]>[1]): ReturnType<GatewaySessionHost["sessionPromptPart"]> {
  ctx.methods.storedSession(sessionId);
  const runtime = ctx.host.collection.get(sessionId);
  const body = runtime?.promptBody();
  if (!runtime || !body) throw new WireError("NOT_FOUND", "This session has no captured request: it is asleep or has not sent one.");
  if (request.part === "raw") return { sessionId, ...body };
  if (request.part === "messages") return { sessionId, ...pagePromptMessages(body, request.offset ?? 0, request.limit ?? PROMPT_PAGE_DEFAULT) };
  const exposures = new Map(runtime.capabilityCatalog().entries.filter((entry) => entry.id.startsWith("tool:")).map((entry) => [entry.name, entry.exposure ?? "direct"]));
  return { sessionId, ...listPromptTools(body, (name) => exposures.get(name) ?? null) };
}
