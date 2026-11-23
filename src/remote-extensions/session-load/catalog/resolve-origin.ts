import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import type { LoadContext } from "../load-types.ts";

export function origin(ctx: LoadContext, tool: Pick<ToolInfo, "name">): { group: string; groupLabel: string; source: string; instance: string; location: "local" | "target" } | undefined {
      const status = ctx.tools.get(tool.name);
      return status ? {
        group: `group:tools:remote:${status.instance}:${status.name}`, groupLabel: status.name,
        source: ctx.projectEntries.get(status.name) ?? status.name, instance: status.instance, location: status.location,
      } : undefined;
}
