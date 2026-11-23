import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { CatalogContext, CatalogTool, CollectedCatalogMetadata } from "./catalog-types.ts";
import { extensionStartupSource } from "./extension-startup-source.ts";

export function collectMetadata(ctx: CatalogContext, session: AgentSession): CollectedCatalogMetadata {
  const input = ctx.input;
  const saved = input.toolLibrary.list().filter((entry) => entry.status !== "archived");
  const sharedSkills = input.skillLibrary.list();
  const sharedPaths = new Set(input.skillLibrary.paths());
  const available = (info: Parameters<typeof extensionStartupSource>[0]) => {
    const source = extensionStartupSource(info);
    return source === undefined || !ctx.pluginFailures?.has(source);
  };
  const loadedSkills = session.resourceLoader.getSkills();
  const skills = { ...loadedSkills, skills: loadedSkills.skills.filter((skill) => available(skill.sourceInfo)) };
  const extensions = session.resourceLoader.getExtensions().extensions.filter((extension) => available(extension.sourceInfo));
  input.onPluginCommands?.(extensions.map((extension) => ({
    source: extension.sourceInfo.source,
    commands: [...extension.commands.values()].map(({ name, description }) => ({ name, description })),
  })));
  const extensionNames = new Set(extensions.flatMap((extension) => [...extension.tools.keys()]));
  // PRK's native factory owns the supported host tools; SDK defaults may include other shells.
  const tools = new Map<string, CatalogTool>(session.getAllTools()
    .filter((tool) => available(tool.sourceInfo) && (ctx.nativeNames.has(tool.name) || extensionNames.has(tool.name)))
    .map((tool) => [tool.name, tool]));
  return { saved, sharedSkills, sharedPaths, skills, tools };
}

