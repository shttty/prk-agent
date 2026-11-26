import type { MouseEvent } from "react";
import type { DirEntry } from "../file-paths/path-types.ts";

/** One directory's cached listing. */
export type TreeNode = { open?: boolean; loading?: boolean; error?: string; entries?: DirEntry[]; truncated?: boolean };

/** What the inline name input is for. `target` is the execution target the intent was started for. */
export type Editing = { kind: "file" | "directory"; dir: string; target: string } | { kind: "rename"; entry: DirEntry; target: string };

/** The copied or cut entry waiting to be pasted. */
export type Clip = { mode: "copy" | "cut"; entry: DirEntry; target: string };

export type Removing = DirEntry & { target: string };

/** Uploads that met an existing file, waiting for the overwrite decision. */
export type Clashes = { dir: string; items: { file: File; path: string }[]; target: string };

export type UploadProgress = { name: string; bytes: number; size: number };

/** Where a picked upload goes. */
export type UploadDestination = { dir: string; target: string };

/** The open file menu (or phone sheet): its entry (null: the directory) and where it opened. */
export type FileMenuState = { entry: DirEntry | null; x: number; y: number; sheet?: boolean };

/** What the rows of one tree need from it (see TreeContext). */
export type TreeContextValue = {
  showHidden: boolean;
  query: string;
  nodes: Record<string, TreeNode>;
  goTo: (path: string) => void;
  openFile: (entry: DirEntry) => void;
  activePath: string | null;
  editing: Editing | null;
  cutPath: string | null;
  onMenu: (event: MouseEvent<HTMLElement>, entry: DirEntry | null) => void;
  onMore: (event: MouseEvent<HTMLElement>, entry: DirEntry | null) => void;
  commitName: (name: string) => void;
  cancelEdit: () => void;
};
