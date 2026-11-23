import { useRef } from "react";
import { useEffect } from "react";
import { useMemo } from "react";
import { dockComponents } from "./dock-components.jsx";
import { dockTabComponents } from "./dock-tab-components.jsx";
import { DockviewReact } from "dockview-react";
import { NoWatermark } from "./NoWatermark.jsx";
import { createEngine } from "./engine/assemble-engine.js";
import "dockview-react/dist/styles/dockview.css";
import "./editor-dock.css";
export const THEME = { name: "pi", className: "dockview-theme-pi" };

/** The phone workspace's dock: one tab row, no drag, drop or split (the desktop docks the same tabs in its stage grid). */
export function EditorDock({ FilePanel, FileTab, DiffPanel, DiffTab, TerminalPanel, TerminalTab, onReady }) {
  const ready = useRef(onReady);
  ready.current = onReady;
  const engine = useRef(null);
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
    onReady={({ api }) => { engine.current = createEngine(api); ready.current(engine.current); }}
  />;
}
