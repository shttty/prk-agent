import type { KernelLanguage } from "../../../kernel/kernel-types.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { resolveBun } from "../../../kernel/process/resolve-bun.ts";
import { bunConfiguration, checkRuntimeExecutable } from "./bun-configuration.ts";

export async function setKernelLanguage(ctx: RuntimeContext, language: KernelLanguage) {
  return ctx.python.setLanguage(language, async () => {
    const signal = AbortSignal.timeout(ctx.target.kernel.kernelOptions.startTimeoutMs);
    const environment = await ctx.environments.acquire(ctx.target.id);
    try {
      const bun = language === "bun" ? bunConfiguration(ctx.target, ctx.binDir, ctx.channels, environment.info.home, ctx.dependencies.targetCacheRoot) : undefined;
      const executable = bun ? await resolveBun(bun, signal) : ctx.pythonRuntime.python;
      await checkRuntimeExecutable(environment, ctx.cwd, executable, signal);
      return bun;
    } catch (error) {
      throw new WireError("UNAVAILABLE", `Cannot select ${language}: ${error instanceof Error ? error.message : String(error)}`);
    } finally { await environment.release(); }
  }, () => { ctx.sessionManager.appendCustomEntry("gateway-native-session-state", { version: 1, kernelLanguage: language }); });
}
