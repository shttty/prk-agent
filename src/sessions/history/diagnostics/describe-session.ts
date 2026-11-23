import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { SessionReadIssue } from "../history-types.ts";
import { projectAuthorityEntries } from "../format-authority-entries.ts";
import { oneBinding } from "../binding/read-creation-binding.ts";
import { latestRetarget } from "../binding/read-target-selection.ts";
import { latestArchivedState } from "../archive/read-archive-state.ts";

/** Failed metadata parsers supply no target or archive display facts. */
export function describeSession(manager: SessionManager, limits: LimitsOptions): {
  readonly display: Pick<SessionReadIssue, "location" | "label" | "target" | "archived">;
} {
  const display: { location: SessionReadIssue["location"]; label?: string; target?: string; archived?: SessionReadIssue["archived"] } = { location: "unknown" };
  try {
    const label = manager.getSessionName();
    if (label !== undefined) display.label = label;
  } catch { /* Display information is optional. */ }
  let entries;
  try { entries = projectAuthorityEntries(manager, limits); } catch { return { display }; }
  try {
    const binding = oneBinding(entries, limits);
    if (binding) display.target = binding.target;
  } catch { /* An invalid binding cannot establish a target. */ }
  try {
    const selection = latestRetarget(entries, limits);
    if (selection) display.target = selection.target;
  } catch { /* Keep only a validated creation target. */ }
  try {
    const archived = latestArchivedState(entries, limits);
    display.location = archived === undefined ? "active" : "archived";
    if (archived) display.archived = archived;
  } catch { /* Archive placement is unknown if its metadata is invalid. */ }
  return { display };
}
