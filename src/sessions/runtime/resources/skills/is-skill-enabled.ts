import type { Skill } from "@earendil-works/pi-coding-agent";
import { capabilityEnabled } from "../../capabilities/is-capability-enabled.ts";
import { origin } from "./classify-skill.ts";
import type { RuntimeContext } from "../../runtime-state.ts";

export function skillEnabled(ctx: RuntimeContext, skill: Skill) {
    const source = origin(ctx, skill);
    return capabilityEnabled(ctx, `skill:${skill.filePath}`, source.group)
      && (source.group !== "group:skills:shared" || ctx.sharedPaths.has(skill.filePath));
  }
