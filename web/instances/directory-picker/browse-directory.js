import { text } from "../../sessions/sidebar/text.js";
import { targetError } from "../target-errors/target-error.js";
/** The picker only ever holds the current absolute target path; the Gateway returns every path already absolute. */
export async function browseDirectory(actions, connection, path, setDirectory, mountedRef, browseSerial) {
  const serial = ++browseSerial.current;
  setDirectory((current) => ({ ...current, loading: true, error: "" }));
  try {
    const result = await actions.browseTarget(connection, path);
    if (!mountedRef.current || serial !== browseSerial.current) return;
    setDirectory({ path: text(result?.path) || path, atRoot: result?.atRoot === true, entries: Array.isArray(result?.entries) ? result.entries : [], truncated: result?.truncated === true, loading: false, error: "" });
  } catch (cause) {
    // The requested path stays current, so "上一级" can leave a directory that cannot be listed.
    if (mountedRef.current && serial === browseSerial.current) setDirectory({ path, atRoot: false, entries: [], truncated: false, loading: false, error: targetError(cause).text });
  }
}
