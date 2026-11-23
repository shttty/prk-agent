import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { ArchivedState } from "../history-types.ts";
import { latestArchivedState } from "./read-archive-state.ts";

export function archivedField(entries: readonly SessionEntry[], limits: LimitsOptions): { readonly archived?: ArchivedState } {
  const archived = latestArchivedState(entries, limits);
  return archived === undefined ? {} : { archived };
}
