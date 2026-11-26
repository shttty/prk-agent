import type { Engine } from "./engine/engine-types.ts";
import type { FilePanelComponent, FileTabComponent, TerminalPanelComponent, TerminalTabComponent } from "./editor-dock-types.ts";
import { useRef } from "react";
import { useEffect } from "react";
import { useMemo } from "react";
import { dockComponents } from "./dock-components.tsx";
import { dockTabComponents } from "./dock-tab-components.tsx";
import { DockviewReact } from "dockview-react";
import { NoWatermark } from "./NoWatermark.ts";
import { createEngine } from "./engine/assemble-engine.ts";
import "dockview-react/dist/styles/dockview.css";
import "./editor-dock.css";
export const THEME = { name: "pi", className: "dockview-theme-pi" };

type EditorDockProps = {
  FilePanel: FilePanelComponent; FileTab: FileTabComponent; DiffPanel: FilePanelComponent; DiffTab: FileTabComponent;
  TerminalPanel: TerminalPanelComponent; TerminalTab: TerminalTabComponent; onReady: (engine: Engine) => void;
};

/** The phone workspace's dock: one tab row, no drag, drop or split (the desktop docks the same tabs in its stage grid). */
export function EditorDock({ FilePanel, FileTab, DiffPanel, DiffTab, TerminalPanel, TerminalTab, onReady }: EditorDockProps) {
  const ready = useRef(onReady);
  ready.current = onReady;
  const engine = useRef<Engine | null>(null);
  useEffect(() => () => engine.current?.dispose(), []);
  const components = useMemo(() => dockComponents({ FilePanel, DiffPanel, TerminalPanel }), [FilePanel, DiffPanel, TerminalPanel]);
  const tabComponents = useMemo(() => dockTabComponents({ FileTab, DiffTab, TerminalTab }), [FileTab, DiffTab, TerminalTab]);
  return <DockviewReact
    className="pi-dockview"
    theme={THEME}
    components={components}
    tabComponents={tabComponents}
    watermarkComponent={NoWatermark}
    disableFloatingGroups
    disableDnd
    locked
    scrollbars="native"
    onReady={({ api }) => { const created = createEngine(api); engine.current = created; ready.current(created); }}
  />;
}
