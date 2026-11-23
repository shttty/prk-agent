import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ToolLibraryRegistrationContext } from "../registration-types.ts";
import type { executionSchema } from "./execution-schema.ts";

export async function executeSavedTool(ctx: ToolLibraryRegistrationContext, name: string, ...[id, params, signal, onUpdate, context]: Parameters<ToolDefinition<typeof executionSchema>["execute"]>) {
  ctx.refresh();
  if (!ctx.allowed(`prk_saved_${name}`)) throw new Error(`Saved tool ${JSON.stringify(name)} is disabled for this session.`);
  const python = ctx.python();
  if (python.getSnapshot().state === "busy") throw new Error("A saved tool cannot start another execute request while this kernel is busy. Call the Python function directly in the current cell instead.");
  const current = ctx.library.active(name);
  const payload = JSON.stringify({ entry: current, args: params.args ?? [], kwargs: params.kwargs ?? {} });
  const result = await python.executeForeground(id, { code: `_prk.library_execute(_prk._json.loads(${JSON.stringify(payload)}))`, title: `Tool: ${name}` }, signal, onUpdate, context);
  if (result.details.outcome === "ok") ctx.library.used(current.name, current.version, ctx.sessionId());
  return result;
}
