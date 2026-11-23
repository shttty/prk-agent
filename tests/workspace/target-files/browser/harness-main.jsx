// Real-component harness for S2: the product's desktop stage / phone pane (file tree + editor + file store), DirectoryPicker with its
// browseDirectory, and the @ reference path (loadReferenceCandidates + ReferenceMenu + selectReference), all consuming the
// real Gateway→HTTP API through the product request wrapper. Nothing here fakes files or responses. The page is driven by
// URL parameters and `window.__harness`: the Workbench is not mounted, so the session row's target/cwd (which the Workbench
// takes from `session_recovered`) are explicit props here, changed by `setEnvironment`.
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "../../../../web/node_modules/@mantine/core/styles.css";
import "../../../../web/design-system/tokens/tokens.css";
import "../../../../web/design-system/element-styles/element-styles.css";
import "../../../../web/shell/page/page.css";
import ThemeProvider from "../../../../web/design-system/theme/ThemeProvider.jsx";
import { createWorkbenchStore } from "../../../../web/workbench/store/assemble-workbench-store.js";
import { initializeStoreContext } from "../../../../web/workbench/store/initialize-store-context.js";
import { subscribe } from "../../../../web/workbench/store/updates/subscribe.js";
import { loadReferenceCandidates as loadStoreCandidates } from "../../../../web/workbench/store/references/load-reference-candidates.js";
import { clearReferenceCandidates as clearStoreCandidates } from "../../../../web/workbench/store/references/clear-reference-candidates.js";
import WorkspacePane from "../../../../web/workspace/pane/WorkspacePane.jsx";
import { layout } from "../../../../web/shell/layout/layout-store.js";
import DesktopStage from "../../../../web/shell/stage/DesktopStage.jsx";
import { DirectoryPicker } from "../../../../web/instances/directory-picker/DirectoryPicker.jsx";
import { browseDirectory } from "../../../../web/instances/directory-picker/browse-directory.js";
import { EMPTY_DIRECTORY } from "../../../../web/instances/directory-picker/empty-directory.js";
import { loadReferenceCandidates } from "../../../../web/chat/composer/load-reference-candidates.js";
import { referenceState } from "../../../../web/chat/composer/reference-state.js";
import { selectReference } from "../../../../web/chat/composer/select-reference.js";
import { ReferenceMenu } from "../../../../web/chat/composer/references/ReferenceMenu.jsx";

const query = new URLSearchParams(location.search);
const sessionId = query.get("session");
const compact = query.get("compact") === "1";
const store = createWorkbenchStore();
const api = store.actions.api;
// The @ path needs the Workbench store context (selected session row, request token); only its data is seeded.
const refCtx = { apiRoot: "/api" };
initializeStoreContext(refCtx);
refCtx.state = { ...refCtx.state, selectedSessionId: sessionId };
layout.set({ workspaceOpen: true, treeOpen: true, treePinned: !compact });

function Picker({ env }) {
  const [directory, setDirectory] = useState(EMPTY_DIRECTORY);
  const [open, setOpen] = useState(false);
  const [cwd, setCwd] = useState(env.cwd);
  const mounted = useRef(true);
  const serial = useRef(0);
  const connection = { target: env.target, url: "http://127.0.0.1:1" };
  const browse = (path) => browseDirectory(store.actions, connection, path, setDirectory, mounted, serial);
  return <section id="harness-picker" data-open={String(open)}>
    <input id="harness-cwd" value={cwd} readOnly />
    <button id="harness-open-picker" type="button" onClick={() => { setOpen(true); void browse(cwd); }}>浏览</button>
    {open ? <DirectoryPicker directory={directory} onBrowse={browse} onBack={() => setOpen(false)} onSelect={(path) => { setCwd(path); setOpen(false); }} /> : null}
  </section>;
}

function Composer({ env }) {
  const [text, setText] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [attached, setAttached] = useState([]);
  const [index, setIndex] = useState(0);
  const candidates = useSyncExternalStore((listener) => subscribe(refCtx, listener), () => refCtx.state.session.referenceCandidates);
  useEffect(() => { refCtx.state.sessions.set(sessionId, { sessionId, target: env.target }); }, [env.target]);
  const actions = useMemo(() => ({
    loadReferenceCandidates: (token) => loadStoreCandidates(refCtx, token),
    clearReferenceCandidates: () => clearStoreCandidates(refCtx),
    setReferences: setAttached,
  }), []);
  const state = referenceState({ composerText: text, candidates: candidates.value, popupDismissed: dismissed });
  useEffect(() => { loadReferenceCandidates({ referenceQuery: state.referenceQuery, actions }); }, [state.referenceQuery, actions, env.target]);
  const select = (reference) => selectReference({ referenceBase: state.referenceBase, setComposerText: setText, composerText: text, setPopupDismissed: setDismissed, rowTarget: env.target, rowSessionId: sessionId, snapshotSessionId: sessionId, attachedReferences: attached, actions }, reference);
  const model = { referenceMenuOpen: state.referenceMenuOpen, referenceListRef: useRef(null), references: state.references, referenceCandidates: candidates, referenceIndex: index, setReferenceIndex: setIndex, selectReference: select };
  return <section id="harness-composer">
    <textarea id="composer" value={text} onChange={(event) => { setDismissed(false); setText(event.target.value); }} />
    <ReferenceMenu model={model} />
    <ul id="harness-attached">{attached.map((reference) => <li key={reference.path} data-path={reference.path} data-target={reference.target} />)}</ul>
  </section>;
}

function Harness() {
  const [env, setEnv] = useState({ target: query.get("target"), cwd: query.get("cwd") });
  useEffect(() => { window.__harness = { setEnvironment: setEnv, environment: () => env }; }, [env]);
  return <div id="harness" data-target={env.target} data-cwd={env.cwd}>
    {/* --pi-card-gap: set on the workbench root by App; the stage's frame and control offsets are computed from it. */}
    <div id="harness-pane" style={{ display: "flex", height: 620, width: compact ? 390 : 1080, position: "relative", border: "1px solid #888", "--pi-card-gap": "8px" }}>
      {compact
        ? <WorkspacePane key={sessionId} api={api} sessionId={sessionId} target={env.target} cwd={env.cwd} hidden={false} controls={null} place="harness" refreshKey="" terminalEnabled={false} diffRequest={null} onDiffServed={() => {}} />
        : <DesktopStage key={sessionId} api={api} sessionId={sessionId} target={env.target} cwd={env.cwd} place="harness" refreshKey="" terminalEnabled={false} workspaceAvailable chat={<div id="harness-chat" className="pi-chatcol" />} onShape={() => {}} diffRequest={null} onDiffServed={() => {}} />}
    </div>
    <Picker env={env} />
    <Composer env={env} />
  </div>;
}

createRoot(document.getElementById("root")).render(<ThemeProvider api={api}><Harness /></ThemeProvider>);
