import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { PROJECT_TYPE } from "../history-protocol.ts";
import { latestCustomEntry } from "./find-latest-metadata.ts";
import { isRecord } from "./is-history-metadata-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { projectValue } from "./validate-project.ts";

export function latestProject(entries: readonly SessionEntry[], limits: LimitsOptions): { projectId?: string; projectName?: string } {
  const entry = latestCustomEntry(entries, PROJECT_TYPE);
  if (entry === undefined) return {};
  const data: unknown = entry.data;
  if (!isRecord(data)) invalid("project metadata at /");
  if (data.version !== 1) invalid("project metadata at /version");
  if (!("project" in data)) invalid("project metadata at /project");
  const project = projectValue(data.project, limits);
  return project === null ? {} : { projectId: project.id, projectName: project.name };
}
