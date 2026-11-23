import type { ModuleDependencies } from "./module-types.ts";

export function dependencies(value: unknown): ModuleDependencies {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("dependencies must be an object");
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => key !== "binaries" && key !== "python")
    || (item.binaries !== undefined && (!Array.isArray(item.binaries) || !item.binaries.every((name) => typeof name === "string" && /^[A-Za-z0-9_-]+$/u.test(name))))
    || (item.python !== undefined && (!Array.isArray(item.python) || !item.python.every((dep) => dep && typeof dep === "object" && !Array.isArray(dep)
      && typeof dep.name === "string" && dep.name.length > 0
      && Object.keys(dep).every((key) => ["name", "version", "sha256", "filename"].includes(key))
      && [dep.version, dep.filename].every((field) => field === undefined || typeof field === "string")
      && (dep.sha256 === undefined || (typeof dep.sha256 === "string" && /^[a-f0-9]{64}$/u.test(dep.sha256))))))) {
    throw new Error("Invalid module dependencies: expected binaries names and python [{name,version?,sha256?,filename?}]");
  }
  return item as ModuleDependencies;
}
