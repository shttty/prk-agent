import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export function resolvePythonSelections(converted, selections, directory) {
  for (const target of converted.instances.instances) {
    const previous = converted.legacy.get(target.id);
    if (!previous || !previous.local) continue;
    const names = new Set([previous.defaultKernelName, ...selections.filter((selection) => selection.target === target.id).map((selection) => selection.kernelName)].filter(Boolean));
    const mappings = [];
    let unresolved = names.size === 0;
    for (const name of names) {
      if (!directory) { unresolved = true; continue; }
      let spec;
      try { spec = JSON.parse(readFileSync(join(directory, name, "kernel.json"), "utf8")); }
      catch (error) { if (!["ENOENT", "EACCES", "EPERM"].includes(error.code)) throw error; unresolved = true; continue; }
      const python = spec.argv?.[0];
      if (typeof python !== "string" || !isAbsolute(python) || /\p{Cc}/u.test(python)) throw new Error(`Target ${target.id}: kernelspec ${name} does not identify an absolute Python executable`);
      mappings.push({ name, python });
    }
    const paths = new Set(mappings.map(({ python }) => python));
    if (paths.size > 1) throw new Error(`Target ${target.id} has conflicting legacy Python selections: ${mappings.map(({ name, python }) => `${name} -> ${python}`).join("; ")}`);
    if (unresolved) delete target.python;
    else target.python = mappings[0].python;
  }
}
