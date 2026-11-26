import type { DockviewApi } from "dockview-react";
import type { PathPanel } from "../../editor-layout/editor-layout-types.ts";

/** What the engine needs of a dock: the phone's own dockview api, or the stage's view of its grid (workspaceView). */
export type EngineHost = Pick<DockviewApi, "panels" | "groups" | "activeGroup" | "activePanel" | "getPanel" | "addPanel" | "toJSON" | "fromJSON" | "clear" | "onDidLayoutChange" | "onDidActivePanelChange" | "onDidRemovePanel">;

type Unsubscribe = () => void;

/** The workspace's tab operations on a dock; the dock's own state stays in dockview. */
export type Engine = {
  restore: (raw: string) => string[];
  listen: () => void;
  openFile: (path: string) => string;
  findByPath: (path: string) => string | null;
  paths: () => string[];
  count: () => number;
  openDiff: (path: string) => string;
  activePath: () => string | null;
  close: (id: string) => void;
  closePaths: (gone: string) => void;
  renamePaths: (from: string, to: string) => void;
  mergeGroups: () => void;
  onChange: (listener: (json: string | null) => void) => Unsubscribe;
  onActivePath: (listener: (path: string | null) => void) => Unsubscribe;
  onPanelRemoved: (listener: (path: string | null) => void) => Unsubscribe;
  dispose: () => void;
  openTerminal: (name: string, focus?: boolean) => boolean;
  closeTerminal: (name: string) => void;
  terminalNames: () => string[];
};

/** The engine's host and listeners plus its own operations bound to them; each operation file takes this first. */
export type EngineContext = Engine & {
  api: EngineHost;
  subscriptions: { dispose: () => void }[];
  changeListeners: Set<(json: string | null) => void>;
  activeListeners: Set<(path: string | null) => void>;
  removedListeners: Set<(path: string | null) => void>;
  panelsOf: (component: string) => PathPanel[];
  panels: () => PathPanel[];
  emitChange: () => void;
};
