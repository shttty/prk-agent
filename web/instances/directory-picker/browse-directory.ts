import type { Dispatch, RefObject, SetStateAction } from "react";
import type { AbsoluteListing, TargetConnection } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { targetError } from "../target-errors/target-error.ts";
import type { DirectoryState } from "./directory-types.ts";

/** The picker only ever holds the current absolute target path; the Gateway returns every path already absolute. */
export async function browseDirectory(actions: WorkbenchActions, connection: TargetConnection, path: string, setDirectory: Dispatch<SetStateAction<DirectoryState>>, mountedRef: RefObject<boolean>, browseSerial: RefObject<number>) {
  const serial = ++browseSerial.current;
  setDirectory((current) => ({ ...current, loading: true, error: "" }));
  try {
    const result: AbsoluteListing = await actions.browseTarget(connection, path);
    if (!mountedRef.current || serial !== browseSerial.current) return;
    setDirectory({ path: result.path || path, atRoot: result.atRoot, entries: result.entries, truncated: result.truncated, loading: false, error: "" });
  } catch (cause) {
    // The requested path stays current, so "上一级" can leave a directory that cannot be listed.
    if (mountedRef.current && serial === browseSerial.current) setDirectory({ path, atRoot: false, entries: [], truncated: false, loading: false, error: targetError(cause).text });
  }
}
