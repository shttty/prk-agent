import { parseTags } from "./parse-tags.js";

/**
 * The instance as POST/PATCH sends it. A new instance omits a missing command or interpreter (it is saved pending).
 * An edit sends only what changed: emptied optional fields go as "" (the Gateway clears them); unchanged fields are
 * omitted (kept). Missing connection/interpreter fields save as pending; a missing mirror inherits the global setting.
 * `local: true` drops a stored command. The command is sent exactly as typed; only all-blank counts as empty.
 * `saved`: the stored instance when editing, null when adding.
 */
export function targetPayload(form, saved) {
  const target = { id: form.id, label: form.label.trim(), tags: parseTags(form.tags), local: form.local, cwd: form.cwd.trim() };
  const command = form.sshCommand.trim() ? form.sshCommand : "";
  const python = form.python.trim();
  if (!form.local) assign(target, "sshCommand", command, saved && (saved.local === true ? "" : saved.sshCommand ?? ""));
  assign(target, "python", python, saved && (saved.python ?? ""));
  assign(target, "pythonIndexUrl", form.pythonIndexUrl.trim(), saved && (saved.pythonIndexUrl ?? ""));
  if (form.executionTimeoutMs !== undefined) target.executionTimeoutMs = form.executionTimeoutMs;
  return target;
}

function assign(target, key, value, stored) {
  if (stored === null) {
    if (value) target[key] = value;
  } else if (value !== stored) target[key] = value;
}
