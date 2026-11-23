import { type LimitsOptions, DEFAULT_LIMITS_OPTIONS } from "../../../config/limits/limits-options.ts";
import type { HistoryContext } from "../history-types.ts";
import { invalid } from "../reject-invalid-history.ts";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadRecords } from "./load-records.ts";

export async function loadHistory(options: { readonly cwd: string; readonly directory: string; readonly limits?: LimitsOptions }): Promise<HistoryContext> {
  if (!options || typeof options.cwd !== "string" || typeof options.directory !== "string") invalid("options");
  const limits = options.limits ?? DEFAULT_LIMITS_OPTIONS;
  const directory = resolve(options.directory);
  await mkdir(directory, { recursive: true });
  const loaded = await loadRecords(directory, limits);
  const records = loaded.sessions;
  return { limits, directory, records, readFailures: loaded.readFailures };
}
