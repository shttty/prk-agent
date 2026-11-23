import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import type { TargetSettingsContext } from "./resource-types.ts";
import { withLock } from "./with-lock.ts";

/** Frozen remote snapshot; Pi retains merge, trust, setters and reload semantics without writing either machine's files. */
export function targetSessionSettings(agentDir: string, project: string | undefined, projectTrusted = true): SettingsManager {
  let global: string | undefined;
  try { global = readFileSync(join(agentDir, "settings.json"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const ctx: TargetSettingsContext = { global, project };
  const manager = SettingsManager.fromStorage({ withLock: (scope, update) => withLock(ctx, scope, update) }, { projectTrusted });
  const errors = manager.drainErrors();
  if (errors.length) throw new AggregateError(errors.map(({ error }) => error), "Unable to load target session settings.");
  return manager;
}
