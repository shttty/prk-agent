import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ModuleSource } from "./module-types.ts";
import { entries } from "./read-module-entries.ts";

export const collect = async (sources: Record<string, ModuleSource>, file: string, fullname: string, pkg: boolean): Promise<void> => {
  sources[fullname] = { source: await readFile(file, "utf8"), path: file, package: pkg };
  if (!pkg) return;
  for (const child of await entries(dirname(file))) {
    if (child.isFile() && child.name.endsWith(".py") && child.name !== "__init__.py" && /^[A-Za-z_]\w*\.py$/u.test(child.name)) {
      await collect(sources, join(dirname(file), child.name), `${fullname}.${child.name.slice(0, -3)}`, false);
    } else if (child.isDirectory() && /^[A-Za-z_]\w*$/u.test(child.name)
      && (await entries(join(dirname(file), child.name))).some((entry) => entry.name === "__init__.py" && entry.isFile())) {
      await collect(sources, join(dirname(file), child.name, "__init__.py"), `${fullname}.${child.name}`, true);
    }
  }
};
