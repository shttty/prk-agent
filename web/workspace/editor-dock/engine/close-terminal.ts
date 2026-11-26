import type { EngineContext } from "./engine-types.ts";
import { terminalPanelId } from "../../editor-layout/terminal-panel-id.ts";

export function closeTerminal(ctx: EngineContext, name: string) { ctx.api.getPanel(terminalPanelId(name))?.api.close(); }
