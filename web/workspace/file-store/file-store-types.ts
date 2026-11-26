import type { ApiFailure, PageApi } from "../../shell/page/page-types.ts";

export type { ApiFailure };

export type FileKind = "image" | "markdown" | "text" | "binary";

/** One document the editor holds, as read from (and written back to) the execution target. */
export type OpenFile = {
  path: string;
  name: string;
  kind: FileKind;
  view: string;
  content: string;
  original: string;
  loading: boolean;
  saving?: boolean;
  error?: string;
  saveError?: string;
  conflict?: boolean;
  retargeted?: boolean;
  epoch?: number;
  target?: string | null;
  lastModified?: string;
  mimetype?: string;
  writable?: boolean;
};

export type FileChanges = Partial<OpenFile> | ((file: OpenFile) => Partial<OpenFile>);

/** The store's shared state plus its own operations bound to it; each operation file takes this as its first argument. */
export type FileStoreContext = {
  api: PageApi;
  base: string;
  onGone?: (path: string) => void;
  environment: string | null;
  epoch: number;
  files: Map<string, OpenFile>;
  listeners: Set<() => void>;
  restored: Set<string>;
  emit: () => void;
  patch: (path: string, changes: FileChanges) => void;
  load: (path: string) => Promise<void>;
  ensure: (path: string) => void;
  save: (path: string, force?: boolean) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  get: (path: string) => OpenFile | undefined;
  markRestored: (paths: Iterable<string>) => void;
  edit: (path: string, content: string) => void;
  setView: (path: string, view: string) => void;
  isDirty: (path: string) => boolean;
  dirtyUnder: (root: string) => boolean;
  forget: (path: string) => void;
  remap: (from: string, to: string) => void;
  drop: (root: string) => void;
  reloadOpen: (paths: Iterable<string>) => void;
  rebind: (environment: string | null) => void;
};

/** The operations other regions use (the context without its state). */
export type FileStore = Pick<FileStoreContext, "subscribe" | "get" | "ensure" | "load" | "save" | "markRestored" | "edit" | "setView" | "isDirty" | "dirtyUnder" | "forget" | "remap" | "drop" | "reloadOpen" | "rebind">;
