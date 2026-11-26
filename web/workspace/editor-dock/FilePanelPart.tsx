import type { DockviewPanelApi } from "dockview-react";
import { useVisible } from "./use-visible.ts";
import type { FilePanelComponent } from "./editor-dock-types.ts";

type FilePanelPartProps = { Panel: FilePanelComponent; api: DockviewPanelApi; params: { path: string } };

export function FilePanelPart({ Panel, api, params }: FilePanelPartProps) {
  const visible = useVisible(api);
  return <Panel id={api.id} path={params.path} visible={visible} />;
}
