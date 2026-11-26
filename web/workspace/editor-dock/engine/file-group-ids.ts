import type { EngineContext } from "./engine-types.ts";
import { TERMINAL_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";

/** Groups a new file or diff tab may join: those holding a file or diff tab, so a dedicated terminal group (split below
 * or beside) is skipped. Only terminal groups: all groups. */
export function fileGroupIds(ctx: EngineContext) {
  const all = ctx.api.groups;
  const withFiles = all.filter((group) => group.panels.some((panel) => panel.api.component !== TERMINAL_COMPONENT));
  return (withFiles.length ? withFiles : all).map((group) => group.id);
}
