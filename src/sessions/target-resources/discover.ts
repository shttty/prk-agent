import { dirname, join, posix } from "node:path";
import { CONFIG_DIR_NAME, createSyntheticSourceInfo, parseFrontmatter, type PromptTemplate } from "@earendil-works/pi-coding-agent";
import { ArtifactStore } from "../../artifacts/store/assemble-store.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { SessionOptions } from "../../config/session/session-options.ts";
import { buildNativeToolHost } from "../../remote-extensions/bundle/build-native-tool-host.ts";
import { DEFAULT_REMOTE_HOST_OPTIONS, type RemoteHostOptions } from "../../config/remote-host/remote-host-options.ts";
import { deployRemoteExtensionArtifacts } from "../../remote-extensions/deployment/deploy-artifacts.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import { targetSkillsFromReply } from "../target-skills/parse-target-skills-reply.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { files } from "./files.ts";
import type { TargetResources } from "./resource-types.ts";

export async function discoverTargetResources(lease: TargetLease, cwd: string, agentDir: string, limits: LimitsOptions, options: SessionOptions, store?: ArtifactStore, runtime: RemoteHostOptions["runtime"] = DEFAULT_REMOTE_HOST_OPTIONS.runtime, binChunkBytes?: number): Promise<TargetResources> {
  const probe = await lease.request("skills", "probe", { cwd, configDir: CONFIG_DIR_NAME });
  if (typeof probe.requiresPi !== "boolean") throw new WireError("INVALID_REQUEST", "Invalid target resource dependency probe.");
  const resourceStore = probe.requiresPi ? store ?? new ArtifactStore(join(dirname(agentDir), "assets")) : undefined;
  const deployed = resourceStore ? await deployRemoteExtensionArtifacts(lease, resourceStore.directory, (platform) => buildNativeToolHost({ store: resourceStore, platform, cacheOnly: true }), false, runtime, binChunkBytes) : {};
  const reply = await lease.request("skills", "resources", {
    cwd, configDir: CONFIG_DIR_NAME, ...deployed,
    contextFileBytes: limits.contextFileBytes, contextTotalBytes: limits.contextTotalBytes,
    noContextFiles: options.noContextFiles, noSkills: options.noSkills,
    noPromptTemplates: options.noPromptTemplates, noExtensions: options.noExtensions,
    projectTrusted: true,
  });
  if (typeof reply.validationError === "string") throw new WireError("INVALID_REQUEST", `Target project resources for ${cwd}: ${reply.validationError}`);
  if (!files(reply.agentsFiles) || !files(reply.prompts) || !Array.isArray(reply.extensions)
    || !reply.extensions.every((path) => typeof path === "string" && posix.isAbsolute(path))
    || !Array.isArray(reply.entries) || !reply.entries.every((entry) => entry && typeof entry.path === "string" && (entry.frontmatter === undefined || typeof entry.frontmatter === "string"))
    || (reply.settings !== undefined && typeof reply.settings !== "string")) throw new WireError("INVALID_REQUEST", "Invalid target resource discovery response.");
  let bytes = 0;
  for (const file of [...reply.agentsFiles, ...reply.prompts, ...reply.entries.map((entry) => ({ path: entry.path, content: entry.frontmatter ?? "" })), ...(reply.settings === undefined ? [] : [{ path: posix.join(cwd, CONFIG_DIR_NAME, "settings.json"), content: reply.settings }])]) {
    const size = Buffer.byteLength(file.content);
    if (size > limits.contextFileBytes || (bytes += size) > limits.contextTotalBytes) throw new WireError("INVALID_REQUEST", `Target resource response exceeds configured context limits: ${file.path}`);
  }
  const prompts = reply.prompts.map(({ path, content }): PromptTemplate => {
    const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(content);
    const firstLine = body.split("\n").find((line) => line.trim()) ?? "";
    const description = typeof frontmatter.description === "string" && frontmatter.description ? frontmatter.description
      : firstLine.slice(0, 60) + (firstLine.length > 60 ? "..." : "");
    return { name: posix.basename(path).replace(/\.md$/u, ""), description, content: body, filePath: path,
      ...(typeof frontmatter["argument-hint"] === "string" && frontmatter["argument-hint"] ? { argumentHint: frontmatter["argument-hint"] } : {}),
      sourceInfo: createSyntheticSourceInfo(path, { source: "target", scope: "project", origin: "top-level", baseDir: posix.dirname(path) }) };
  });
  return { agentsFiles: reply.agentsFiles, settings: reply.settings, prompts, extensions: reply.extensions, skills: targetSkillsFromReply(reply, "resource") };
}
