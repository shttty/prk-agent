import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";
import { invalid } from "../reject-invalid-history.ts";

export function validateArchiveGroup(group: string, limits: LimitsOptions): void {
  try { validateMetadataSessionId(group, "session archive group", limits); }
  catch { invalid("session archive group at /group"); }
  if (group === "." || group === ".." || /[\\/]/.test(group)) invalid("session archive group at /group");
}
