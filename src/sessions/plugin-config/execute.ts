import type { JsonValue } from "@earendil-works/pi-ai";
import type { PluginConfigContext, PluginConfigArgs } from "./config-types.ts";
import { invalid } from "./reject-invalid-config.ts";
import { get } from "./get.ts";
import { set } from "./descriptors/register-provider-schema.ts";

export async function execute(ctx: PluginConfigContext, ...[_id, request, signal]: PluginConfigArgs) {
  signal?.throwIfAborted();
  if (request.action === "set" && request.file === undefined) invalid("set requires file.");
  const view = request.action === "set" ? set(ctx, request.provider, request.file!, request.sections ?? []) : get(ctx, request.provider);
  return { content: [{ type: "text" as const, text: JSON.stringify(view) }], structuredContent: view as unknown as JsonValue, details: view };
}
