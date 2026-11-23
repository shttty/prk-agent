import { unlink } from "node:fs/promises";
import type { HostContext } from "../host/host-state.ts";
import type { ToolTitleSettings } from "../../config/session/session-options.ts";
import { isToolTitleSettings } from "../../config/session/is-tool-title-settings.ts";
import { readPrkConfigSnapshot } from "../../config/document/read-prk-config-snapshot.ts";
import { readPrkInstanceSnapshot } from "../../config/document/read-prk-instance-snapshot.ts";
import { parsePrkConfig } from "../../config/document/parse-prk-config.ts";
import { stageConfig } from "../instances/stage-config.ts";
import { publishConfig } from "../instances/publish-config.ts";
import { WireError } from "../wire/create-error.ts";

export async function toolTitleSet(ctx: HostContext, request: ToolTitleSettings): Promise<ToolTitleSettings> {
  if (!isToolTitleSettings(request)) throw new WireError("INVALID_REQUEST", "Tool title settings require exactly {enabled: boolean}.");
  const toolTitle = request.enabled;
  return ctx.methods.exclusive(async () => {
    const snapshot = await readPrkConfigSnapshot(ctx.host.paths.configPath);
    const instances = await readPrkInstanceSnapshot(ctx.instances.targetConfigPath);
    const document = snapshot.document ?? {};
    try {
      parsePrkConfig(document, instances.document ?? { instances: [] });
      document.session = { ...document.session as Record<string, unknown> | undefined, toolTitle };
      parsePrkConfig(document, instances.document ?? { instances: [] });
    } catch (error) {
      throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration.");
    }
    const staged = await stageConfig(ctx.host.paths.configPath, document);
    try {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; tool title settings were not changed.");
      publishConfig(ctx.host.paths.configPath, staged, snapshot.hash);
      ctx.host.config = { ...ctx.host.config, session: { ...ctx.host.config.session, toolTitle } };
      return ctx.methods.toolTitleGet();
    } finally {
      await unlink(staged.temporary).catch(() => {});
    }
  });
}
