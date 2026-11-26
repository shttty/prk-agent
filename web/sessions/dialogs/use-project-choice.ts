import { useState } from "react";
import type { ArchiveGroup } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchReads } from "../workbench-reads-types.ts";
import type { SessionRows } from "../session-row-types.ts";
import type { ProjectPayload } from "../sidebar/sidebar-types.ts";
import { projectCatalog } from "../sidebar/grouping/project-catalog.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

// A dialog-local option, never a Gateway project identity (which cannot contain '/').
export const DRAFT_PROJECT = "draft/project";

/** What the project dialog and the create dialog read back: a new project by name, or an existing project (`null` = ungrouped). */
export type ProjectResolution = { name: string; project?: undefined } | { name?: undefined; project: ProjectPayload | null };

export type ProjectChoice = {
  projects: ProjectPayload[];
  selected: string | null;
  setSelected: (id: string | null) => void;
  draft: string;
  createDraft: (name: string) => void;
  resolve: () => ProjectResolution;
};

/**
 * Draft selection shared by the project dialog and the create dialog.
 * `resolve()` returns `{ name }` (the caller decides about its id) or `{ project }`
 * (an existing `{id,name}`, or `null` = ungrouped). Names are unique; the Gateway enforces it again.
 */
export function useProjectChoice(initialId = ""): ProjectChoice {
  const sessions: SessionRows = useWorkbench((state: WorkbenchReads) => state.sessions);
  const archive: ArchiveGroup[] = useWorkbench((state: WorkbenchReads) => state.archive);
  const projects = projectCatalog([...sessions.values(), ...archive.flatMap((group) => group.sessions)]);
  const [selected, setSelected] = useState<string | null>(initialId || null);
  const [draft, setDraft] = useState("");
  const createDraft = (name: string) => { setDraft(name); setSelected(DRAFT_PROJECT); };
  const resolve = (): ProjectResolution => selected === DRAFT_PROJECT
    ? { name: draft }
    : { project: projects.find((item) => item.id === selected) || null };
  return { projects, selected, setSelected, draft, createDraft, resolve };
}
