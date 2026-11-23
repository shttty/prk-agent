// Real-component harness for S3: the product's desktop stage / phone pane (shell tabs + xterm TerminalView + end dialog) consuming
// the real Gateway→HTTP→WS API of tests/fixtures/pty-browser. The Workbench is not mounted: `session` is a URL parameter /
// `window.__harness.setSession` (what selecting a session row does), and `refresh()` moves `refreshKey` (what a terminal
// event does in the Workbench). Nothing here fakes terminal data or responses.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../web/node_modules/@mantine/core/styles.css";
// The app's own web fonts (as web/main.jsx): the terminal's cell size depends on them, and they load lazily.
import "../../../web/node_modules/@fontsource-variable/figtree/wght.css";
import "../../../web/node_modules/@fontsource-variable/noto-sans-sc/wght.css";
import "../../../web/node_modules/@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-Regular/result.css";
import "../../../web/node_modules/@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-Bold/result.css";
import "../../../web/design-system/tokens/fonts.css";
import "../../../web/design-system/tokens/tokens.css";
import "../../../web/design-system/element-styles/element-styles.css";
import "../../../web/shell/page/page.css";
import ThemeProvider from "../../../web/design-system/theme/ThemeProvider.jsx";
import { createWorkbenchStore } from "../../../web/workbench/store/assemble-workbench-store.js";
import WorkspacePane from "../../../web/workspace/pane/WorkspacePane.jsx";
import DesktopStage from "../../../web/shell/stage/DesktopStage.jsx";
import { layout } from "../../../web/shell/layout/layout-store.js";

const query = new URLSearchParams(location.search);
const compact = query.get("compact") === "1";
const cwd = query.get("cwd");
const api = createWorkbenchStore().actions.api;
// Desktop: an open stage with its directory pinned beside the grid.
layout.set({ workspaceOpen: query.get("hidden") !== "1", treeOpen: !compact, treePinned: !compact });

function Harness() {
  const [sessionId, setSession] = useState(query.get("session"));
  const [refreshKey, setRefresh] = useState(0);
  const [stageWidth, setStageWidth] = useState(null);
  const [hidden, setHidden] = useState(query.get("hidden") === "1");
  // Below chat floor + workspace group + pinned tree, shrinking the stage also narrows the shell's group.
  useEffect(() => { if (!compact) layout.set({ workspaceOpen: !hidden }); }, [hidden]);
  useEffect(() => { window.__harness = { setSession, setStageWidth, setHidden, refresh: () => setRefresh((value) => value + 1), session: () => sessionId }; }, [sessionId]);
  return <div id="harness" data-session={sessionId}>
    {/* --pi-card-gap: set on the workbench root by App; the stage's frame and control offsets are computed from it. */}
    <div id="harness-pane" style={{ display: "flex", height: 640, width: compact ? 390 : stageWidth ?? 1440, position: "relative", border: "1px solid #888", "--pi-card-gap": "8px" }}>
      {compact
        ? <WorkspacePane key={sessionId} api={api} sessionId={sessionId} cwd={cwd} hidden={hidden} controls={null} place="harness" refreshKey={String(refreshKey)} terminalEnabled diffRequest={null} onDiffServed={() => {}} />
        : <DesktopStage key={sessionId} api={api} sessionId={sessionId} cwd={cwd} place="harness" refreshKey={String(refreshKey)} terminalEnabled workspaceAvailable chat={<div id="harness-chat" className="pi-chatcol" />} onShape={() => {}} diffRequest={null} onDiffServed={() => {}} />}
    </div>
  </div>;
}

createRoot(document.getElementById("root")).render(<ThemeProvider api={api}><Harness /></ThemeProvider>);
