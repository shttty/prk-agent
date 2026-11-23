import type { SkillToolsContext, SkillManageArgs } from "../skill-types.ts";
import { manage } from "../documents/apply-skill-change.ts";
import type { JsonValue } from "@earendil-works/pi-ai";

export async function manageSkill(ctx: SkillToolsContext, ...[_id, request]: SkillManageArgs) {
  const result = manage(ctx.library, request);
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result as JsonValue, details: undefined };
}
