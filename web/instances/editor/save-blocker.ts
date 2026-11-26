import { isAbsolutePath } from "../directory-picker/is-absolute-path.ts";
import type { DraftForm } from "./editor-types.ts";

/**
 * Why the draft cannot be sent yet ("" when it can): input the Gateway would refuse anyway, caught before any request.
 * An explicit changed interpreter is version-checked by the Gateway on save.
 * Missing remote connection saves as pending; an omitted interpreter selects managed Python.
 */
export function saveBlocker(form: Pick<DraftForm, "label" | "cwd" | "python">): "label" | "cwd" | "python-path" | "" {
  if (!form.label.trim()) return "label";
  if (!isAbsolutePath(form.cwd.trim())) return "cwd";
  const python = form.python.trim();
  if (python && !isAbsolutePath(python)) return "python-path";
  return "";
}
