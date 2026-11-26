import type { ProjectArchiveResult } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { postJson } from "../requests/post-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** One request; archived rows leave the list through their own collection events (no workbench refetch). Never retried. */
export async function archiveProject(ctx: StoreContext, projectId: string): Promise<ProjectArchiveResult | null> {
  if (!projectId) return null;
  const body = await postJson(`${ctx.apiRoot}/projects/${encodeURIComponent(projectId)}/archive`, { confirm: true });
  if (!isRecord(body) || body.projectId !== projectId || !Array.isArray(body.archived) || !Array.isArray(body.unarchived)) {
    throw new Error("项目归档结果未确认。");
  }
  // External input boundary: the Gateway's archive outcome; project and lists were checked above.
  return body as unknown as ProjectArchiveResult;
}
