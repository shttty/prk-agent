import type { HostContext } from "../host-state.ts";
import { ArtifactStore } from "../../../artifacts/store/assemble-store.ts";
import { join } from "node:path";
import { homedir } from "node:os";
import type { RemoteExtensionStatus } from "../../../remote-extensions/packages/package-types.ts";
import type { CapabilityCatalog } from "../../../config/capabilities/capability-types.ts";
import { ToolLibrary } from "../../../codemode/tool-library/assemble-tool-library.ts";
import { SkillLibrary } from "../../../sessions/skill-library/assemble-skill-library.ts";
import { MEMORY_AGENT, MemoryStore } from "../../../sessions/memory/assemble-memory.ts";
import { PluginConfigStore } from "../../../sessions/plugin-config/assemble-plugin-config.ts";
import { ThemeStore } from "../../themes/assemble-theme-store.ts";
import { createDerivedSessionSchemas } from "../../../plugins/sessions/create-derived-session-schemas.ts";
import { sanitizeTargets } from "../../instances/format-public-instances.ts";
import { resolve } from "node:path";
import { parseDerivationConfig } from "../../../config/derivation/parse-config.ts";

export function openHostLibraries(ctx: HostContext): void {
  ctx.packages.extensionConfig = ctx.host.config.extensions;
  ctx.packages.pluginWarnings = new Map();
  ctx.packages.pluginFailures = new Map();
  ctx.host.artifactStore = new ArtifactStore(join(ctx.host.paths.home, "assets"));
  ctx.packages.remoteStatuses = new Map<string, RemoteExtensionStatus[]>();
  ctx.packages.remoteCatalogStatuses = new Map<string, RemoteExtensionStatus[]>();
  ctx.capabilities.instanceExtensionCatalogs = new Map<string, CapabilityCatalog>();
  ctx.capabilities.capabilityDefaults = { capabilities: { ...ctx.host.config.session.capabilities }, localTools: ctx.host.config.session.localTools };
  ctx.workspace.terminalOptions = { ...ctx.host.config.terminal, quietLadderMs: [...ctx.host.config.terminal.quietLadderMs] };
  ctx.host.toolLibrary = new ToolLibrary(ctx.host.paths.home, ctx.host.config.tools);
  ctx.host.skillLibrary = new SkillLibrary(ctx.host.paths.home, ctx.host.config.skills);
  // Plugins in this process (e.g. the Hindsight memory plugin) pick PRK's `prk-*-override.toml` from the same directory.
  process.env.MEMORIES_AGENT ??= MEMORY_AGENT;
  ctx.host.memoryStore = new MemoryStore({ enabled: ctx.host.config.memory.enabled, directory: memoriesDirectory(ctx.host.config.memory.directory, ctx.host.paths.home) });
  ctx.host.pluginConfig = new PluginConfigStore(ctx.host.paths.home);
  ctx.host.themes = new ThemeStore(ctx.host.paths.home);
  ctx.derivation.derivationSchemas = createDerivedSessionSchemas(ctx.host.config.limits);
  ctx.lifecycle.sessionIdleTimeoutMs = ctx.host.config.session.idleTimeoutMs;
  ctx.instances.targetConfigPath = ctx.host.paths.instancesPath;
  ctx.derivation.derivationConfig = ctx.host.options.derivation === undefined ? ctx.host.config.derivation : parseDerivationConfig({ derivation: ctx.host.options.derivation });
  ctx.instances.targets = ctx.host.options.targets === undefined ? [...ctx.host.config.instances] : [...ctx.host.options.targets];
  ctx.instances.publicTargets = sanitizeTargets(ctx.instances.targets);
  ctx.host.historyDirectory = ctx.host.options.historyDir ?? resolve(ctx.host.paths.home, ctx.host.config.session.historyDir);
}

function memoriesDirectory(configured: string, home: string): string {
  if (configured === "~" || configured.startsWith("~/")) return join(homedir(), configured.slice(2));
  return resolve(home, configured);
}
