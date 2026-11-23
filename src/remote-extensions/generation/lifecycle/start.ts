import { posix } from "node:path";
import { DEFAULT_REMOTE_HOST_OPTIONS } from "../../../config/remote-host/remote-host-options.ts";
import { deployRemoteExtensionArtifacts } from "../../deployment/deploy-artifacts.ts";
import type { GenerationContext, Registration } from "../generation-types.ts";
import { request } from "../requests/request.ts";
import { fail } from "./fail.ts";
import { close } from "./close.ts";
import { errorOf } from "../connection/normalize-error.ts";
import { publishMonitor } from "../telemetry/publish-monitor.ts";

export async function start(ctx: GenerationContext): Promise<Registration> {
    try {
      const runtime = ctx.options.hostOptions?.runtime ?? DEFAULT_REMOTE_HOST_OPTIONS.runtime;
      const runtimeArgs = runtime === "bun"
        ? ctx.options.hostOptions?.bunArgs ?? DEFAULT_REMOTE_HOST_OPTIONS.bunArgs
        : ctx.options.hostOptions?.nodeArgs ?? DEFAULT_REMOTE_HOST_OPTIONS.nodeArgs;
      const paths = await deployRemoteExtensionArtifacts(ctx.lease, ctx.options.storeDir, ctx.options.artifacts, ctx.options.nativeTools, runtime, ctx.options.binChunkBytes);
      const packages = [];
      for (const pkg of ctx.options.packages) {
        if (!pkg.artifacts) packages.push({ name: pkg.name, extensions: pkg.extensions });
        else {
          const deployed = await deployRemoteExtensionArtifacts(ctx.lease, ctx.options.storeDir, pkg.artifacts, false, runtime, ctx.options.binChunkBytes);
          packages.push({ name: pkg.name, extensions: pkg.extensions.map((path) => posix.join(deployed.bundle, path)) });
        }
      }
      const started = await ctx.lease.request("remoteExtensions", "start", {
        generation: ctx.generation, runtime: paths.runtime, host: posix.join(paths.bundle, "host/host.mjs"),
        memoryMax: ctx.options.hostOptions?.memoryMax ?? 1073741824,
        memorySwapMax: ctx.options.hostOptions?.memorySwapMax ?? 0,
        runtimeArgs,
        cwd: ctx.options.cwd, env: ctx.options.nativeTools ? {
          ...ctx.options.env, PI_OFFLINE: "1",
          // Pi checks its own bin before PATH. An empty per-bundle agent directory
          // prevents unrelated target-side Pi installs from shadowing these artifacts.
          PI_CODING_AGENT_DIR: posix.join(paths.bundle, ".native-agent"),
          PRK_CODING_AGENT_DIR: posix.join(paths.bundle, ".native-agent"),
        } : ctx.options.env ?? {},
        ...(ctx.options.nativeTools ? { pathPrepend: paths.toolDirs } : {}),
      }) as { pid: number; rootPid: number; scoped: boolean };
      if (!Number.isSafeInteger(started.pid) || started.pid <= 0 || !Number.isSafeInteger(started.rootPid)
        || started.rootPid <= 0 || started.pid === started.rootPid || typeof started.scoped !== "boolean") {
        throw new Error("Invalid remote host/root startup identity");
      }
      ctx.scoped = started.scoped;
      ctx.live = true;
      ctx.registration = await request(ctx, "load", {
        generation: ctx.generation,
        nativeTools: ctx.options.nativeTools,
        telemetryIntervalMs: ctx.options.telemetryIntervalMs ?? 1000,
        packages,
        projectExtensions: ctx.options.projectExtensions ?? [],
        providerOwnerIds: ctx.options.providerOwnerIds ?? [],
        snapshot: { revision: 0, cwd: ctx.options.cwd, projectTrusted: ctx.options.projectTrusted },
      }) as Registration;
      if (ctx.registration.pid !== started.pid || ctx.registration.rootPid !== started.rootPid) {
        throw new Error("Remote host load identity does not match its owned startup root");
      }
      ctx.options.onGeneration?.(ctx);
      publishMonitor(ctx, "running");
      return ctx.registration;
    } catch (error) {
      fail(ctx, errorOf(error));
      await close(ctx, "load-failed");
      throw error;
    }
}
