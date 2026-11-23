import type { HostContext } from "../../host/host-state.ts";
import type { ExecutionConfigDocument } from "../../host/host-types.ts";
import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import type { WorkbenchSnapshot } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { readPrkConfigDocument } from "../../../config/document/read-prk-config-document.ts";
import { readPrkInstanceSnapshot } from "../../../config/document/read-prk-instance-snapshot.ts";
import { parsePrkConfig } from "../../../config/document/parse-prk-config.ts";
import { sanitizeTargets } from "../format-public-instances.ts";
import { ExecutionTargetBusyError } from "../../../sessions/collection/create-execution-target-busy-error.ts";
import { stageConfig } from "../stage-config.ts";
import { publishConfig } from "../publish-config.ts";
import { unlink } from "node:fs/promises";

export async function mutatePersistedTargets(ctx: HostContext, mutate: (document: ExecutionConfigDocument, current: readonly ExecutionTarget[]) => void): Promise<WorkbenchSnapshot> {
    if (ctx.host.options.targets !== undefined) {
      throw new WireError("UNSUPPORTED_METHOD", "Target configuration editing is unavailable when targets are explicitly supplied.");
    }
    const globalDocument = await readPrkConfigDocument(ctx.host.paths.configPath) ?? {};
    const snapshot = await readPrkInstanceSnapshot(ctx.instances.targetConfigPath);
    const document = snapshot.document ?? { instances: [] };
    const current = parsePrkConfig(globalDocument, document).instances;
    const candidateDocument = structuredClone(document) as ExecutionConfigDocument;
    mutate(candidateDocument, current);
    const nextTargets = [...parsePrkConfig(globalDocument, candidateDocument).instances];
    const nextPublicTargets = sanitizeTargets(nextTargets);
    for (const previous of ctx.instances.targets) {
      const next = nextTargets.find(({ id }) => id === previous.id);
      if (ctx.instances.environments.get(previous.id)?.pending && (!next || next.local !== previous.local || next.sshCommand !== previous.sshCommand || next.python !== previous.python)) throw new WireError("BUSY", "Wait for the instance environment deployment to finish before changing its connection or deleting it.");
    }
    try {
      ctx.host.collection.previewTargets(nextTargets);
    } catch (error) {
      if (error instanceof ExecutionTargetBusyError) throw new WireError("BUSY", error.message);
      throw error;
    }

    const staged = await stageConfig(ctx.instances.targetConfigPath, candidateDocument, 0o600);
    try {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; configuration was not changed.");
      ctx.host.collection.previewTargets(nextTargets);
      // No await between durable publication and the validated in-memory swap.
      publishConfig(ctx.instances.targetConfigPath, staged, snapshot.hash);
      ctx.host.collection.replaceTargets(nextTargets);
      ctx.methods.publishTargets(nextTargets, nextPublicTargets);
      console.error(`[${new Date().toISOString()}] Gateway session target configuration changed (${nextTargets.length}).`);
      return ctx.methods.workbenchSnapshot();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Gateway session target mutation failed; existing configuration retained.`);
      throw error;
    } finally {
      await unlink(staged.temporary).catch(() => { });
    }
  }
