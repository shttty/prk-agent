import { realpathSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { SKILL_IGNORED_DIRECTORIES } from "../../resource-catalog/skill-scan-constants.ts";
import { within } from "../../resource-catalog/is-within-resource-root.ts";
import type { SkillToolsContext, SkillReader } from "../skill-types.ts";
import { contains } from "./contains.ts";

export async function readSkill(ctx: SkillToolsContext, ...[id, input, signal, onUpdate, toolContext]: Parameters<SkillReader["execute"]>) {
  const { library, skills, target, reader, targetReader } = ctx;
  const requested = resolve(library.directory, input.path);
  const remote = target?.directories().some(({ path }) => within(path, requested));
  const path = remote ? requested : realpathSync(requested);
  const loaded = skills();
  const candidates = (target?.inventory() ?? loaded).filter((skill) => remote ? within(skill.baseDir, path) : !target?.directories().some(({ path: directory }) => within(directory, skill.filePath)) && contains(skill, remote, path));
  const owner = candidates.find((skill) => skill.filePath === requested) ?? candidates.sort((a, b) => b.baseDir.length - a.baseDir.length)[0];
  if (owner && !loaded.some((skill) => skill.filePath === owner.filePath)) {
    const winner = loaded.find((skill) => skill.name === owner.name);
    if (winner) throw new Error(`Skill ${owner.name} is shadowed by skill:${winner.filePath}.`);
  }
  if (!owner || !loaded.some((skill) => skill.filePath === owner.filePath)) throw new Error("Skill file is not in an enabled loaded skill.");
  const result = await (remote ? targetReader : reader).execute(id, { ...input, path }, signal, onUpdate, toolContext);
  if (basename(requested) !== "SKILL.md" || owner.filePath !== requested) return result;
  let files: string[];
  if (remote) {
    const lease = target?.lease();
    if (!lease) throw new Error("Target skill channel is unavailable.");
    const reply = await lease.request("skills", "files", { path });
    if (!Array.isArray(reply.files) || !reply.files.every((file) => typeof file === "string")) throw new Error("Invalid target skill files response.");
    files = reply.files;
  } else {
    files = [];
    const directories = [dirname(path)];
    for (const directory of directories) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!Object.hasOwn(SKILL_IGNORED_DIRECTORIES, entry.name)) directories.push(file);
        } else if (file !== path && (entry.isFile() || (entry.isSymbolicLink() && statSync(file, { throwIfNoEntry: false })?.isFile()))) files.push(file);
      }
    }
    files = files.sort().slice(0, 10);
  }
  const appendix = ["", "", `Base directory for this skill: ${dirname(path)}`,
    "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
    "Note: file list is sampled.", "", "<skill_files>", ...files.map((file) => `<file>${file}</file>`), "</skill_files>"].join("\n");
  return { ...result,
    content: result.content.map((part) => part.type === "text" ? { ...part, text: part.text + appendix } : part),
    structuredContent: typeof result.structuredContent === "string" ? result.structuredContent + appendix : result.structuredContent,
  };
}
