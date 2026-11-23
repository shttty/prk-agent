import { postJson } from "../requests/post-json.js";
import { normalizeEnvironment } from "../../payloads/normalize-environment.js";
import { applyTargetEnvironment } from "./apply-target-environment.js";
/** `POST /api/targets/:target/environment` (202): starts or joins the instance's one check/deploy and answers its current
 * snapshot, merged under the stream/revision rule (a later event already received is kept). Returns the held snapshot. */
export async function deployEnvironment(ctx, targetName) {
  const body = await postJson(ctx, `${ctx.apiRoot}/targets/${encodeURIComponent(targetName)}/environment`, {});
  const environment = normalizeEnvironment(body);
  if (!environment || environment.target !== targetName) throw new Error("远端环境状态未确认。");
  return applyTargetEnvironment(ctx, environment) ?? environment;
}
