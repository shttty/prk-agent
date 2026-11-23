import { terminalPanelId } from "../../editor-layout/terminal-panel-id.js";

export function closeTerminal(ctx, name) { ctx.api.getPanel(terminalPanelId(name))?.api.close(); }
