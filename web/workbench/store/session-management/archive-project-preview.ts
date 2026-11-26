import type { ProjectArchivePreview } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { getJson } from "../requests/get-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

export async function archiveProjectPreview(ctx: StoreContext, projectId: string): Promise<ProjectArchivePreview | null> {
  if (!projectId) return null;
  const body = await getJson(`${ctx.apiRoot}/projects/${encodeURIComponent(projectId)}/archive-preview`);
  if (!isRecord(body) || body.projectId !== projectId || !Array.isArray(body.sessions) || !Array.isArray(body.retained)) {
    throw new Error("服务未返回有效的项目归档预览。");
  }
  return body as unknown as ProjectArchivePreview;
}
