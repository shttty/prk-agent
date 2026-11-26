import type { StoreContext } from "../store-context-types.ts";
import type { TargetEnvironmentView } from "./target-types.ts";
import { postJson } from "../requests/post-json.ts";
import { normalizeEnvironment } from "../../payloads/normalize-environment.ts";
import { applyTargetEnvironment } from "./apply-target-environment.ts";

/** `POST /api/targets/:target/environment` (202): starts or joins the instance's one check/deploy and answers its current
 * snapshot, merged under the stream/revision rule (a later event already received is kept). Returns the held snapshot. */
export async function deployEnvironment(ctx: StoreContext, targetName: string): Promise<TargetEnvironmentView> {
  const body = await postJson(`${ctx.apiRoot}/targets/${encodeURIComponent(targetName)}/environment`, {});
  const environment = normalizeEnvironment(body);
  if (!environment || environment.target !== targetName) throw new Error("远端环境状态未确认。");
  return applyTargetEnvironment(ctx, environment) ?? environment;
}
