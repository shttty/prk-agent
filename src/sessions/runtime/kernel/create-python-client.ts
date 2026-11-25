import { createPythonTool } from "../../../kernel/assemble-kernel.ts";
import type { PythonToolClient, PythonToolHooks } from "../../../kernel/kernel-types.ts";
import { parseProcessWindowLimits } from "../../../target-environment/process-window/parse-limits.ts";
import { DEFAULT_TRACE_OPTIONS } from "../../../config/trace/trace-options.ts";
import { DEFAULT_NAMESPACE_OPTIONS } from "../../../config/namespace/namespace-options.ts";
import { kernelPrelude } from "../../../codemode/kernel-prelude/build-prelude.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../../../config/kernel/kernel-options.ts";
import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { allowGatewayTool } from "./allow-gateway-tool.ts";
import { fileReadNotice } from "./file-read-notice.ts";
import { kernelCapabilities } from "./kernel-capabilities.ts";
import { libraryEntries } from "./library-entries.ts";
import { onToolCatalog } from "./on-tool-catalog.ts";
import { readIsolationEnvironment } from "../../derivation/read-isolation-environment.ts";
import { DEFAULT_TARGET_CACHE_ROOT } from "../../../config/target-cache/target-cache-options.ts";
import { bunConfiguration } from "./bun-configuration.ts";

export async function createPythonClient(ctx: RuntimeContext): Promise<PythonToolClient> {
  const hooks: PythonToolHooks = {
    environment: { ...ctx.pythonRuntime.env, ...readIsolationEnvironment(ctx.sessionManager) },
    codeMode: true, binDir: ctx.binDir,
    outputOptions: ctx.dependencies.terminalOptions,
    executionPolicy: ctx.dependencies.kernelExecutionPolicy,
    allowGatewayTool: allowGatewayTool.bind(undefined, ctx),
    get fileReadNotice() { return fileReadNotice(ctx); },
    kernelCapabilities: kernelCapabilities.bind(undefined, ctx),
    libraryEntries: libraryEntries.bind(undefined, ctx),
    onToolCatalog: onToolCatalog.bind(undefined, ctx),
    onFailure: ctx.dependencies.onKernelFailure,
    prelude: (scoped) => kernelPrelude({
      codemode: ctx.codemodeOptions,
      trace: ctx.dependencies.traceOptions ?? DEFAULT_TRACE_OPTIONS,
      kernel: { ...(ctx.target.kernel.kernelOptions ?? DEFAULT_KERNEL_OPTIONS), ...(scoped === undefined ? {} : { scoped }) },
      namespace: ctx.dependencies.namespaceOptions ?? DEFAULT_NAMESPACE_OPTIONS,
      moduleHome: ctx.moduleHome,
      kernelTools: ctx.dependencies.kernelModuleConfig ?? {},
      targetCacheRoot: ctx.dependencies.targetCacheRoot ?? DEFAULT_TARGET_CACHE_ROOT,
      library: ctx.dependencies.toolLibrary?.list().filter((entry) => entry.status !== "archived" && capabilityEnabled(ctx, `tool:prk_saved_${entry.name}`, "group:tools:library")) ?? [],
    }),
  };
  if (ctx.dependencies.createKernel) return ctx.dependencies.createKernel(hooks);
  const { memoryMax, memorySwapMax, ...runtimeOptions } = ctx.target.kernel.kernelOptions;
  let bun;
  if (ctx.nativeState.kernelLanguage === "bun") {
    const environment = await ctx.environments.acquire(ctx.target.id);
    try { bun = bunConfiguration(ctx.target, ctx.binDir, ctx.channels, environment.info.home, ctx.dependencies.targetCacheRoot); }
    finally { await environment.release(); }
  }
  return createPythonTool({ target: ctx.target.id, python: ctx.pythonRuntime.python, cwd: ctx.cwd,
    acquire: () => ctx.environments.acquire(ctx.target.id),
    bun,
    processWindow: ctx.dependencies.processWindow ?? parseProcessWindowLimits(),
    memoryMax, memorySwapMax, scoped: true,
  }, hooks, { ...runtimeOptions, ...ctx.dependencies.kernelRuntimeOptions,
    ...(ctx.target.kernel.executionTimeoutMs === undefined ? {} : { executionTimeoutMs: ctx.target.kernel.executionTimeoutMs }) });
}
