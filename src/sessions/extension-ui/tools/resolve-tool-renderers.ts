import type { UiContext } from "../ui-types.ts";
import type { ToolRenderers } from "@earendil-works/pi-coding-agent";

export function resolveRenderers(ctx: UiContext, name: string): ToolRenderers | undefined { return ctx.session.extensionRunner.resolveToolRenderers(name, () => ctx.session.getToolDefinition(name)); }
