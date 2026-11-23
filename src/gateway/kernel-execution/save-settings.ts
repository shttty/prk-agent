import { unlink } from "node:fs/promises";
import type { HostContext } from "../host/host-state.ts";
import type { KernelExecutionSettings } from "../../config/kernel/kernel-options.ts";
import { isKernelExecutionSettings } from "../../config/kernel/is-kernel-execution-settings.ts";
import { readPrkConfigSnapshot } from "../../config/document/read-prk-config-snapshot.ts";
import { readPrkInstanceSnapshot } from "../../config/document/read-prk-instance-snapshot.ts";
import { parsePrkConfig } from "../../config/document/parse-prk-config.ts";
import { stageConfig } from "../instances/stage-config.ts";
import { publishConfig } from "../instances/publish-config.ts";
import { WireError } from "../wire/create-error.ts";

export async function kernelExecutionSet(ctx: HostContext, request: KernelExecutionSettings): Promise<KernelExecutionSettings> {
  if (!isKernelExecutionSettings(request)) throw new WireError("INVALID_REQUEST", "Kernel execution settings require exactly {asyncExecution: boolean}.");
  return ctx.methods.exclusive(async () => {
    const snapshot = await readPrkConfigSnapshot(ctx.host.paths.configPath);
    const instances = await readPrkInstanceSnapshot(ctx.instances.targetConfigPath);
    const document = snapshot.document ?? {};
    try {
      parsePrkConfig(document, instances.document ?? { instances: [] });
      document.kernel = { ...document.kernel as Record<string, unknown> | undefined, asyncExecution: request.asyncExecution };
      parsePrkConfig(document, instances.document ?? { instances: [] });
    } catch (error) {
      throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration.");
    }
    const staged = await stageConfig(ctx.host.paths.configPath, document);
    try {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; kernel execution settings were not changed.");
      publishConfig(ctx.host.paths.configPath, staged, snapshot.hash);
      ctx.host.config = { ...ctx.host.config, kernel: { ...ctx.host.config.kernel, asyncExecution: request.asyncExecution } };
      for (const entry of ctx.host.collection.snapshot()) {
        if (entry.state === "closed" || entry.state === "closing") continue;
        ctx.host.collection.get(entry.sessionId)?.refreshToolDeclarations();
      }
      return ctx.methods.kernelExecutionGet();
    } finally {
      await unlink(staged.temporary).catch(() => {});
    }
  });
}
