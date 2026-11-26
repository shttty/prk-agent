import { isAbsolutePath } from "../directory-picker/is-absolute-path.ts";
import type { DraftForm } from "./editor-types.ts";

export function pickerStartDirectory(mode: "directory" | "file", form: Pick<DraftForm, "cwd" | "python">): string {
  const cwd = form.cwd.trim();
  const python = form.python.trim();
  const directory = isAbsolutePath(cwd) ? cwd : "";
  const pythonDirectory = isAbsolutePath(python) ? python.slice(0, python.lastIndexOf("/")) || "/" : "";
  return (mode === "file" ? pythonDirectory || directory : directory || pythonDirectory) || "/";
}
