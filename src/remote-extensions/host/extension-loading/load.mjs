import { snapshot } from "../dispatch/apply-session-snapshot.mjs";
import { registrationApi } from "./create-registration-api.mjs";
import { rejectPackage } from "./reject-package.mjs";
import { loadProjectExtensions } from "./load-project-extensions.mjs";
import { send } from "../connection/send-frame.mjs";
import { shutdown } from "../shutdown.mjs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encode } from "../../codec/encode.mjs";
import { startMemoryTelemetry } from "../../memory/start-telemetry.mjs";
import { sessionManagerMembers } from "../../sdk-context/create-context.mjs";

export async function load(ctx, data) {
  if (ctx.loadAttempted) throw new Error("A remote extension host accepts exactly one generation/load attempt");
  ctx.loadAttempted = true;
  const projectExtensions = data?.projectExtensions === undefined ? [] : data.projectExtensions;
  const providerOwnerIds = data?.providerOwnerIds === undefined ? [] : data.providerOwnerIds;
  if (!data || typeof data.generation !== "string" || !data.generation || !Array.isArray(data.packages) ||
      !Array.isArray(projectExtensions) || !projectExtensions.every((path) => typeof path === "string" && isAbsolute(path)) ||
      new Set(projectExtensions).size !== projectExtensions.length ||
      !Array.isArray(providerOwnerIds) || providerOwnerIds.length > 4096 ||
      !providerOwnerIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 1024) ||
      new Set(providerOwnerIds).size !== providerOwnerIds.length ||
      (data.nativeTools !== undefined && typeof data.nativeTools !== "boolean") ||
      (!data.packages.length && !projectExtensions.length && data.nativeTools !== true) ||
      !data.packages.every((pkg) => pkg && typeof pkg.name === "string" && pkg.name && Array.isArray(pkg.extensions) &&
        pkg.extensions.length && pkg.extensions.every((path) => typeof path === "string" && isAbsolute(path))) ||
      new Set(data.packages.map((pkg) => pkg.name)).size !== data.packages.length ||
      data.packages.some((pkg) => pkg.name === "Pi native tools")) {
    throw new TypeError("load requires a generation, absolute extension entries, and packages, projectExtensions or nativeTools: true");
  }
  let sdk;
  let eventBus;
  let jiti;
  if (data.packages.length === 0 && projectExtensions.length === 0) {
    // Approved Pi 1.6.0 seam: resolve the package without executing its root entry.
    const sdkDir = fileURLToPath(new URL("../", import.meta.resolve("@earendil-works/pi-coding-agent")));
    const { version } = JSON.parse(await readFile(join(sdkDir, "package.json"), "utf8"));
    if (version !== "1.6.0") throw new Error(`Remote tools-only host requires Pi 1.6.0; found ${version}. Reverify the internal tools/event-bus seam before upgrading.`);
    [sdk, eventBus] = await Promise.all([
      import(pathToFileURL(join(sdkDir, "dist/core/tools/index.js")).href),
      import(pathToFileURL(join(sdkDir, "dist/core/event-bus.js")).href),
    ]);
  } else {
    sdk = eventBus = await import("@earendil-works/pi-coding-agent");
    if (data.packages.length) {
      const { createJiti } = await import("jiti");
      const peers = ["@earendil-works/pi-coding-agent", "@earendil-works/pi-agent-core", "@earendil-works/pi-ai", "@earendil-works/pi-tui", "typebox"];
      jiti = createJiti(ctx.sourceUrl, { fsCache: false, alias: Object.fromEntries(peers.map((name) => [name, fileURLToPath(import.meta.resolve(name))])) });
    }
  }
  const owner = ctx.generation = {
    id: data.generation, phase: "loading", snapshot: undefined, tools: new Map(), toolNames: new Set(),
    handlers: new Map(), commands: [], commandHandlers: new Map(), commandsInFlight: new Map(), nativeDefinitions: new Set(),
    events: eventBus.createEventBus(), packages: [], providerOwnerIds: new Set(providerOwnerIds),
  };
  try {
    snapshot(ctx, owner, data.snapshot);
    owner.sessionManager = ctx.facade(owner, "sessionManager", sessionManagerMembers(ctx, owner));
    if (data.nativeTools) {
      const pkg = { name: "Pi native tools", index: owner.packages.length, tools: [], handlers: [], commands: [] };
      owner.packages.push(pkg);
      const api = registrationApi(ctx, owner, pkg);
      const {
        createReadToolDefinition, createBashToolDefinition, createEditToolDefinition,
        createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition,
      } = sdk;
      for (const createTool of [
        createReadToolDefinition, createBashToolDefinition, createEditToolDefinition,
        createWriteToolDefinition, createGrepToolDefinition, createFindToolDefinition, createLsToolDefinition,
      ]) {
        const tool = createTool(owner.snapshot.cwd);
        owner.nativeDefinitions.add(tool);
        api.registerTool(tool);
      }
    }
    for (const entry of data.packages) {
      const pkg = { name: entry.name, index: owner.packages.length, tools: [], handlers: [], commands: [] };
      owner.packages.push(pkg);
      try {
        for (const path of entry.extensions) {
          const factory = await jiti.import(path, { default: true });
          if (owner.phase !== "loading") throw new Error("Remote extension load was cancelled");
          if (typeof factory !== "function") throw new TypeError(`Extension has no default factory: ${path}`);
          await factory(registrationApi(ctx, owner, pkg, path));
          if (owner.phase !== "loading") throw new Error("Remote extension load was cancelled");
        }
      } catch (error) {
        rejectPackage(ctx, owner, pkg, error);
      }
    }
    await loadProjectExtensions(ctx, owner, sdk, projectExtensions);
    ctx.memoryTelemetry = startMemoryTelemetry(data.telemetryIntervalMs, (memory) => {
      send(ctx, { kind: "memory", id: "host:memory", payload: encode(memory) });
    });
    // Commit metadata only after every factory and every declaration has succeeded.
    owner.phase = "active";
    return {
      tools: [...owner.tools.values()].map((tool) => tool.declaration),
      handlers: [...owner.handlers.values()].filter((handler) => handler.enabled).map(({ event, handlerId }) => ({ event, handlerId })),
      commands: owner.commands,
      pid: process.pid,
      rootPid: process.ppid,
      packages: owner.packages.map(({ name, tools, commands, error, errorCode, errorDetails, sourceInfo, providerErrors = [] }) => ({ name, tools, commands, providerErrors,
        ...(sourceInfo === undefined ? {} : { sourceInfo }), ...(error === undefined ? {} : { error, errorCode, errorDetails }) })),
    };
  } catch (error) {
    await shutdown(ctx, "quit").catch((cleanup) => console.error("[remote-extension host] failed-load cleanup:", cleanup));
    throw error;
  }
}
