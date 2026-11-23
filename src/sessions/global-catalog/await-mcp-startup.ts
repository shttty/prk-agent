import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { CatalogContext } from "./catalog-types.ts";
import { extensionStartupSource } from "./extension-startup-source.ts";
import { notify } from "./notify.ts";
import { recordPluginError } from "./record-plugin-error.ts";

/** Invoke only an actually registered command, never prompt() and its model fallback. */
export async function waitForMcpStartup(ctx: CatalogContext, session: AgentSession): Promise<void> {
  const runner = session.extensionRunner;
  const command = runner.getCommand("mcp");
  if (!command) return;
  if (command.name !== "mcp" || command.invocationName !== "mcp") throw new Error("The registered MCP startup command is ambiguous.");
  const source = extensionStartupSource(command.sourceInfo);
  if (source && ctx.pluginFailures.has(source)) return;
  const context = runner.createCommandContext();
  if (context.mode === "tui") throw new Error("MCP catalog discovery requires a non-TUI command context.");
  // SDK 1.3.0's non-TUI /mcp status handler awaits its pending startup connections.
  const descriptors = Object.getOwnPropertyDescriptors(context);
  descriptors.ui = { enumerable: true, value: { ...context.ui,
    notify: (message: string, type?: "info" | "warning" | "error") => notify(ctx, message, type, source),
  } };
  try { await command.handler("", Object.defineProperties({}, descriptors) as typeof context); }
  catch (error) { recordPluginError(ctx, source, `/mcp: ${error instanceof Error ? error.message : String(error)}`, "Unattributed startup command"); }
}
