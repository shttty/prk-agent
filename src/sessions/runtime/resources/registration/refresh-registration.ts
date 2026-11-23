import { posix } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { WireError } from "../../../../gateway/wire/create-error.ts";
import type { RuntimeContext } from "../../runtime-state.ts";

/** Observe target registration files only when an explicit capability action requests them. */
export async function refreshRegistration(ctx: RuntimeContext): Promise<void> {
  const lease = ctx.skillLease;
  if (!lease) throw new WireError("UNAVAILABLE", "Target resource registration channel is unavailable.");
  const paths = [...new Set([
    ...ctx.targetSkills.skills.map((skill) => skill.filePath),
    ...ctx.targetSkills.directories.map((directory) => directory.path),
    ...(ctx.targetResources?.extensions ?? []),
    posix.join(ctx.cwd, CONFIG_DIR_NAME, "extensions"),
    posix.join(ctx.cwd, CONFIG_DIR_NAME, "skills"),
    posix.join(ctx.cwd, ".agents/skills"),
  ])];
  const settings = [posix.join(ctx.cwd, CONFIG_DIR_NAME, "settings.json")];
  if (paths.length + settings.length > 4096 || Buffer.byteLength(JSON.stringify([paths, settings])) > 256 * 1024) {
    throw new WireError("INVALID_REQUEST", "Target registration paths exceed the 4096-entry / 256 KiB budget.");
  }
  const reply = await lease.request("skills", "registration", { paths, settings });
  const expected = [...paths, ...settings.map((path) => `settings:${path}`)];
  if (!Array.isArray(reply.versions) || reply.versions.length !== expected.length
    || !reply.versions.every((entry, index) => Array.isArray(entry) && entry.length === 2 && entry[0] === expected[index] && typeof entry[1] === "string")
    || Buffer.byteLength(JSON.stringify(reply.versions)) > 256 * 1024) {
    throw new WireError("INVALID_REQUEST", "Invalid target registration versions response.");
  }
  if (ctx.skillLease === lease) ctx.currentRemoteRegistration = JSON.stringify(reply.versions);
}
