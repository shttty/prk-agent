import type { SkillLibraryContext } from "../skill-types.ts";
import { relative, resolve, sep } from "node:path";
import { age } from "../lifecycle/age-records.ts";
import { record as getRecord } from "../lifecycle/get-record.ts";
import { path as resolveOwnedPath } from "./resolve-owned-path.ts";

export function readPath(ctx: SkillLibraryContext, path: string): string {
  age(ctx);
  const local = relative(ctx.directory, resolve(ctx.directory, path));
  const [name, ...parts] = local.split(sep);
  const record = getRecord(ctx, name!);
  if (record.status === "archived") throw new Error("Archived skills are not available to the model.");
  return resolveOwnedPath(ctx, name!, parts.join("/"));
}
