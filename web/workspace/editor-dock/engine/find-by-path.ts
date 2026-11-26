import type { EngineContext } from "./engine-types.ts";
import { findPanelByPath } from "../../editor-layout/find-panel-by-path.ts";

export const findByPath = (ctx: EngineContext, path: string) => findPanelByPath(ctx.panels(), path);
