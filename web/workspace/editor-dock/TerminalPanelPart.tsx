import type { DockviewApi, DockviewPanelApi } from "dockview-react";
import { Suspense } from "react";
import { useVisible } from "./use-visible.ts";
import type { TerminalPanelComponent } from "./editor-dock-types.ts";

type TerminalPanelPartProps = { Panel: TerminalPanelComponent; api: DockviewPanelApi; containerApi: DockviewApi; params: { name: string } };

/** One shell's panel content in dockview: `Panel` is lazy (xterm stays out of the first workspace chunk). The server's end of
 * the shell closes this panel only while dockview still holds it: ending a shell through its tab also closes it once the HTTP
 * close returns, and whichever of the two arrives second must not close it again. */
export function TerminalPanelPart({ Panel, api, containerApi, params }: TerminalPanelPartProps) {
  const visible = useVisible(api);
  const onEnded = () => { if (containerApi.getPanel(api.id)?.api === api) api.close(); };
  return <Suspense fallback={null}><Panel name={params.name} visible={visible} onEnded={onEnded} /></Suspense>;
}
