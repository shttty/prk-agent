import { mkdtemp, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { CONFIG_DIR_NAME, DefaultPackageManager } from "@earendil-works/pi-coding-agent";
import { readProjectSettings } from "./project/read-project-settings.mjs";
import { filterProjectEntries } from "./project/filter-project-entries.mjs";
import { canonicalPath } from "./canonicalize-resource-path.mjs";
import { enabledAgentSkill } from "./skills/match-agent-skill.mjs";
import { readBody } from "./content/read-body.mjs";

export async function resolveResources(request) {
  if (request.configDir !== CONFIG_DIR_NAME) throw new Error(`Target Pi config directory is ${CONFIG_DIR_NAME}, not ${request.configDir}`);
  if (typeof request.cwd !== "string" || !isAbsolute(request.cwd)) throw new Error("cwd must be absolute");
  const agentDir = await mkdtemp(join(tmpdir(), "prk-resources-"));
  try {
    const settings = readProjectSettings(request);
    const errors = settings.drainErrors();
    if (errors.length) throw new Error(`${join(request.cwd, CONFIG_DIR_NAME, "settings.json")}: ${errors.map(({ error }) => error.message).join("; ")}`);
    const manager = new DefaultPackageManager({ cwd: request.cwd, agentDir, settingsManager: settings });
    for (const { source, installedPath } of manager.listConfiguredPackages()) {
      if (!installedPath) throw new Error(`Missing source: ${source}`);
    }
    // Project scope has no temporary git refresh. Missing sources always error before install.
    const resolved = await manager.resolve(async () => "error");
    const project = filterProjectEntries;
    const agentsBases = new Set(request.agentsDirectories.map(({ path }) => dirname(path)));
    const skills = request.noSkills ? [] : project(resolved.skills)
      .filter(({ metadata }) => metadata.source !== "auto" || !agentsBases.has(metadata.baseDir))
      .map(({ path, metadata }) => ({ path, directory: metadata.source === "auto" ? join(metadata.baseDir, "skills") : dirname(path), afterAgents: metadata.origin === "package" }));
    const overrides = settings.getProjectSettings().skills ?? [];
    const authoritativeSkills = new Map(resolved.skills.map((entry) => [canonicalPath(entry.path), entry]));
    const agentsPaths = request.noSkills ? [] : request.agentsEntries.filter(({ path }) => {
      const directory = request.agentsDirectories.find((entry) => path.startsWith(`${entry.path}/`));
      if (!directory) throw new Error(`Target skill has no discovery directory: ${path}`);
      const authoritative = authoritativeSkills.get(canonicalPath(path));
      if (authoritative && (authoritative.metadata.source !== "auto" || !agentsBases.has(authoritative.metadata.baseDir))) return false;
      if (authoritative) return authoritative.enabled;
      return enabledAgentSkill(path, overrides, dirname(directory.path));
    }).map(({ path }) => path);
    const budget = { fileLimit: request.contextFileBytes, totalLimit: request.contextTotalBytes, used: request.usedBodyBytes };
    const prompts = [];
    if (!request.noPromptTemplates) {
      for (const { path } of project(resolved.prompts)) prompts.push({ path, content: await readBody(path, budget) });
    }
    return { skills, agentsPaths, prompts, extensions: request.noExtensions ? [] : project(resolved.extensions).map(({ path }) => path) };
  } finally {
    await rm(agentDir, { recursive: true, force: true });
  }
}
