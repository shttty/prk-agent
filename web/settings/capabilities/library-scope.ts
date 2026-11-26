import type { LibraryEntry, LibraryScope, ScopeChoice } from "./capability-types.ts";
import type { PageActions } from "../../shell/page/page-types.ts";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRows } from "../../workbench/store/store-types.ts";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { latest } from "./latest.ts";
type LibraryScopeOptions = {
  sessions: SessionRows; targets: PublicExecutionTarget[]; generation: RefObject<number>; setSaving: (saving: boolean) => void; setError: (error: string) => void;
  setLibrary: Dispatch<SetStateAction<LibraryEntry[]>>; actions: PageActions;
};

export function libraryScope({ sessions, targets, generation, setSaving, setError, setLibrary, actions }: LibraryScopeOptions): { scope: LibraryScope; scopeLabel: (value: string) => string } {
  const projects = new Map<string, string>();
  for (const sessionRow of sessions.values()) if (sessionRow.projectId && sessionRow.projectName) projects.set(sessionRow.projectId, sessionRow.projectName);
  const instanceName = (name: string) => targets.find((target) => target.id === name)?.label || name;
  const scopeLabel = (value: string) => value === "global" ? "通用" : value.startsWith("instance:") ? instanceName(value.slice(9)) : projects.get(value.slice(8)) ?? value.slice(8);
  const scope: LibraryScope = {
    options: (value) => {
      const choices: { value: string; label: string }[] = [{ value: "global", label: scopeLabel("global") }];
      const instances = targets.map((target) => ({ value: `instance:${target.id}`, label: instanceName(target.id) }));
      const named = [...projects].map(([id, name]) => ({ value: `project:${id}`, label: name }));
      if (![...choices, ...instances, ...named].some((choice) => choice.value === value)) choices.push({ value, label: scopeLabel(value) });
      const grouped: ScopeChoice[] = [...(instances.length ? [{ group: "实例", items: instances }] : []), ...(named.length ? [{ group: "项目", items: named }] : [])];
      return [...choices, ...grouped];
    },
    // No optimistic update: the list returned by the Gateway replaces the local one.
    onChange: async (entry, value) => {
      const current = generation.current;
      setSaving(true); setError("");
      try {
        const result = await actions.api.post<{ skills: LibraryEntry[] }>(`/skills/${encodeURIComponent(entry.name)}/scope`, { scope: value });
        if (current === generation.current) setLibrary(latest(result.skills));
      } catch (cause) { if (current === generation.current) setError(pageErrorMessage(cause)); }
      finally { setSaving(false); }
    },
  };
  return { scope, scopeLabel };
}
