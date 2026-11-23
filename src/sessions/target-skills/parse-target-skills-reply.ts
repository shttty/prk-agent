import { basename, dirname } from "node:path/posix";
import { createSyntheticSourceInfo, parseFrontmatter, type SkillFrontmatter } from "@earendil-works/pi-coding-agent";
import type { Entry, Scan, TargetSkills } from "./skill-types.ts";

export function targetSkillsFromReply(reply: Record<string, unknown>, entryOrder: "directory" | "resource" = "directory"): TargetSkills {
  if (!Array.isArray(reply.directories) || !Array.isArray(reply.entries) || !Array.isArray(reply.scans)) {
    throw new Error("Invalid target skills discovery response.");
  }
  const directories = reply.directories as TargetSkills["directories"];
  const entries = reply.entries as Entry[];
  const result: TargetSkills = {
    directories, skills: [],
    diagnostics: (reply.scans as Scan[]).filter((scan) => scan.error).map((scan) => ({ path: scan.path, message: scan.error! })),
  };
  const roots = [...directories].sort((a, b) => b.path.length - a.path.length);
  const seen = new Set<string>();
  const ordered = entryOrder === "resource" ? entries : directories.flatMap((directory) => entries.filter((entry) => entry.path.startsWith(`${directory.path}/`)));
  for (const entry of ordered) {
      const path = entry.path;
      const directory = roots.find((root) => path.startsWith(`${root.path}/`));
      if (!directory || seen.has(path)) continue;
      seen.add(path);
      try {
        if (!entry || entry.error) throw new Error(entry?.error ?? "Missing target skill frontmatter.");
        const { frontmatter } = parseFrontmatter<SkillFrontmatter>(entry.frontmatter ?? "");
        if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) throw new Error("Skill frontmatter must be a mapping.");
        const name = typeof frontmatter.name === "string" && frontmatter.name ? frontmatter.name : basename(dirname(path));
        if (name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) throw new Error("Skill name must be at most 64 lowercase letters, digits or single separating hyphens.");
        const description = frontmatter.description;
        if (typeof description !== "string" || !description.trim() || description.length > 1024) throw new Error("Skill description must be nonempty text of at most 1024 characters.");
        const baseDir = dirname(path);
        result.skills.push({
          name, description, filePath: path, baseDir,
          sourceInfo: createSyntheticSourceInfo(path, { source: "target", scope: "project", origin: "top-level", baseDir }),
          disableModelInvocation: frontmatter["disable-model-invocation"] === true,
        });
      } catch (error) {
        result.diagnostics.push({ path, message: error instanceof Error ? error.message : String(error) });
      }
  }
  return result;
}
