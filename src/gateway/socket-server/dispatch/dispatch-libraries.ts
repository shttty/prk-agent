import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { ToolLibraryAction } from "../../../codemode/tool-library/library-types.ts";

export const libraryActions: Record<string, ToolLibraryAction> = {
  toolsPromote: "promote", toolsDemote: "demote", toolsArchive: "archive", toolsRestore: "restore", toolsDelete: "delete",
};
export const skillActions: Record<string, ToolLibraryAction> = {
  skillsPromote: "promote", skillsDemote: "demote", skillsArchive: "archive", skillsRestore: "restore", skillsDelete: "delete",
};

export async function dispatchLibraries(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "toolsList") { respond(id, host.toolsList(params.target as string | undefined)); return; }
      if (method === "skillsList") { respond(id, host.skillsList()); return; }
      if (method === "skillsScope") { respond(id, host.skillsScope(params.name as string, params.scope as string)); return; }
      if (method === "themesList") { respond(id, host.themesList()); return; }
      if (method === "themesPreview") { respond(id, host.themesPreview(params.theme)); return; }
      if (method === "themesImport") { respond(id, host.themesImport(params.theme)); return; }
      if (method === "themesDelete") { respond(id, host.themesDelete(params.id as string)); return; }
      if (method === "memoryList") { respond(id, host.memoryList()); return; }
      if (method === "memoryChange") { respond(id, host.memoryChange(params)); return; }
      if (method === "memoryDeleteInstance") { respond(id, host.memoryDeleteInstance(params.instance as string)); return; }
      if (method === "memoryConfigGet") { respond(id, host.memoryConfigGet(params.file as "shared" | "override")); return; }
      if (method === "memoryConfigSave") { respond(id, host.memoryConfigSave(params as unknown as Parameters<GatewaySessionHost["memoryConfigSave"]>[0])); return; }
      if (method === "pluginConfigGet") { respond(id, host.pluginConfigGet(params.provider as string)); return; }
      if (method === "pluginConfigSet") { respond(id, host.pluginConfigSet(params as unknown as Parameters<GatewaySessionHost["pluginConfigSet"]>[0])); return; }
      if (method === "pluginConfigWrite") { respond(id, host.pluginConfigWrite(params as unknown as Parameters<GatewaySessionHost["pluginConfigWrite"]>[0])); return; }
      if (Object.hasOwn(libraryActions, method)) {
        respond(id, host.toolsChange(libraryActions[method]!, params.name as string)); return;
      }
      if (Object.hasOwn(skillActions, method)) {
        respond(id, host.skillsChange(skillActions[method]!, params.name as string)); return;
      }
}
