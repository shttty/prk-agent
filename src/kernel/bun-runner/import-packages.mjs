import { realpathSync } from "node:fs";
import { join } from "node:path";

function pinPackageSet(packageRoot) {
  if (!packageRoot) return undefined;
  try {
    const base = realpathSync(join(packageRoot, "current"));
    if (!/^\/[a-f0-9]{64}$/u.test(base.slice(packageRoot.length)) || !base.startsWith(packageRoot + "/")) throw new Error();
    const expected = [Bun.version, process.platform, process.arch, process.report.getReport().header.glibcVersionRuntime ?? null];
    if (readFileSync(join(base, ".prk-platform.json"), "utf8") !== JSON.stringify(expected)) throw new Error();
    readFileSync(join(base, "bun.lock"));
    return base;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw new Error("Invalid prepared Bun package set for this runtime/platform.");
  }
}

async function importPackage(spec) {
  if (!packageBase) throw new Error("No prepared Bun package set. Run instance package maintenance first.");
  if (typeof spec !== "string" || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*)*$/u.test(spec)) {
    throw new Error("Expected an npm package specifier or package export subpath.");
  }
  try {
    const resolved = realpathSync(Bun.resolveSync(spec, packageBase));
    if (!resolved.startsWith(join(packageBase, "node_modules") + "/")) throw new Error("Dependency is not in the pinned set.");
    return await import(resolved);
  } catch (error) {
    throw new Error(`Could not import ${spec} from the pinned Bun package set.`, { cause: error });
  }
}
