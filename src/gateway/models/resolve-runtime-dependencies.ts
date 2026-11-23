import type { GatewayHostOptions } from "../host/host-types.ts";
import type { PrkConfig } from "../../config/document/document-types.ts";
import type { SessionRuntimeDependencies } from "../../sessions/runtime/runtime-types.ts";
import { modelParts } from "./model-parts.ts";
import { dirname } from "node:path";

export function sdkRuntimeDependencies(options: GatewayHostOptions, config: PrkConfig, agentDir: string, modelRuntime: SessionRuntimeDependencies["modelRuntime"]): SessionRuntimeDependencies {
  const selected = modelParts(options.model);
  const model = modelRuntime.getModel(selected.provider, selected.id);
  if (!model) throw new Error(`Requested session model ${options.model} is unavailable.`);
  return {
    model,
    modelRuntime,
    thinkingLevel: options.thinkingLevel ?? config.session.defaultThinkingLevel,
    cwd: dirname(agentDir),
    agentDir,
    sessionOptions: config.session,
    learningOptions: config.learning,
    terminalOptions: config.terminal,
    traceOptions: config.trace,
    codemodeOptions: config.codemode,
    targetCacheRoot: config.targetCacheRoot,
    limits: config.limits,
  };
}
