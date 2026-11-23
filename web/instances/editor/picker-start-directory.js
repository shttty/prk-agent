import { isAbsolutePath } from "../directory-picker/is-absolute-path.js";

export function pickerStartDirectory(mode, form) {
  const cwd = form.cwd.trim();
  const python = form.python.trim();
  const directory = isAbsolutePath(cwd) ? cwd : "";
  const pythonDirectory = isAbsolutePath(python) ? python.slice(0, python.lastIndexOf("/")) || "/" : "";
  return (mode === "file" ? pythonDirectory || directory : directory || pythonDirectory) || "/";
}
