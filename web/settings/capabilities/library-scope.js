import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { latest } from "./latest.js";
export function libraryScope({ sessions, targets, generation, setSaving, setError, setLibrary, actions }) {
  const projects = new Map();
  for (const sessionRow of sessions.values()) if (sessionRow.projectId && sessionRow.projectName) projects.set(sessionRow.projectId, sessionRow.projectName);
  const instanceName = (name) => targets.find((target) => target.id === name)?.label || name;
  const scopeLabel = (value) => value === "global" ? "通用" : value.startsWith("instance:") ? instanceName(value.slice(9)) : projects.get(value.slice(8)) ?? value.slice(8);
  const scope = {
    options: (value) => {
      const choices = [{ value: "global", label: scopeLabel("global") }];
      const instances = targets.map((target) => ({ value: `instance:${target.id}`, label: instanceName(target.id) }));
      const named = [...projects].map(([id, name]) => ({ value: `project:${id}`, label: name }));
      if (![...choices, ...instances, ...named].some((choice) => choice.value === value)) choices.push({ value, label: scopeLabel(value) });
      return [...choices, ...(instances.length ? [{ group: "实例", items: instances }] : []), ...(named.length ? [{ group: "项目", items: named }] : [])];
    },
    // No optimistic update: the list returned by the Gateway replaces the local one.
    onChange: async (entry, value) => {
      const current = generation.current;
      setSaving(true); setError("");
      try {
        const result = await actions.api.post(`/skills/${encodeURIComponent(entry.name)}/scope`, { scope: value });
        if (current === generation.current) setLibrary(latest(result.skills));
      } catch (cause) { if (current === generation.current) setError(pageErrorMessage(cause)); }
      finally { setSaving(false); }
    },
  };
  return { scope, scopeLabel };
}
