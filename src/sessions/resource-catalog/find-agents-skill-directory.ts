import { basename, dirname } from "node:path";

export function agentsSkillDirectory(file: string): string | undefined {
  let directory = dirname(file);
  while (directory !== dirname(directory)) {
    if (basename(directory) === "skills" && basename(dirname(directory)) === ".agents") return directory;
    directory = dirname(directory);
  }
  return undefined;
}
