import { useState, type FormEvent } from "react";
import type { SessionRow } from "../../workbench/store/store-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { makeId } from "./make-id.ts";
import { runDialogAction } from "./run-dialog-action.ts";
import { ProjectSelector } from "./ProjectSelector.tsx";
import { useProjectChoice } from "./use-project-choice.ts";
import { Stack } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
type ProjectDialogProps = { actions: WorkbenchActions; onClose: () => void; sessionRow: SessionRow | undefined };

export function ProjectDialog({ actions, onClose, sessionRow }: ProjectDialogProps) {
  const saving = useWorkbench((state: WorkbenchState) => state.pending.has("projectMutating"));
  const choice = useProjectChoice(sessionRow?.projectId);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sessionRow) return;
    const resolved = choice.resolve();
    const project = resolved.name ? { id: makeId("project"), name: resolved.name } : resolved.project;
    await runDialogAction(() => actions.assignProject(project ?? null), onClose, setError, "项目归属保存失败。 ", "项目归属保存失败。 ");
  }
  return <form onSubmit={(event) => void submit(event)}><Stack gap="md"><ProjectSelector choice={choice} disabled={saving} /><FormError>{error}</FormError><Group justify="flex-end"><Button variant="default" onClick={onClose}>取消</Button><Button type="submit" loading={saving}>保存</Button></Group></Stack></form>;
}
