import { useState } from "react";
import { projectCatalog } from "../sidebar/grouping/project-catalog.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

// A dialog-local option, never a Gateway project identity (which cannot contain '/').
export const DRAFT_PROJECT = "draft/project";
/**
 * Draft selection shared by the project dialog and the create dialog.
 * `resolve()` returns `{ name }` (the caller decides about its id) or `{ project }`
 * (an existing `{id,name}`, or `null` = ungrouped). Names are unique; the Gateway enforces it again.
 */
export function useProjectChoice(initialId = "") {
  const sessions = useWorkbench((state) => state.sessions);
  const archive = useWorkbench((state) => state.archive);
  const projects = projectCatalog([...sessions.values(), ...archive.flatMap((group) => group.sessions)]);
  const [selected, setSelected] = useState(initialId || null);
  const [draft, setDraft] = useState("");
  const createDraft = (name) => { setDraft(name); setSelected(DRAFT_PROJECT); };
  const resolve = () => selected === DRAFT_PROJECT
    ? { name: draft }
    : { project: projects.find((item) => item.id === selected) || null };
  return { projects, selected, setSelected, draft, createDraft, resolve };
}
