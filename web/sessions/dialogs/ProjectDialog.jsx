import { useState } from "react";
import { text } from "../sidebar/text.js";
import { makeId } from "./make-id.js";
import { runDialogAction } from "./run-dialog-action.js";
import { ProjectSelector } from "./ProjectSelector.jsx";
import { useProjectChoice } from "./use-project-choice.js";
import { Stack } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
export function ProjectDialog({ actions, onClose, sessionRow }) {
  const saving = useWorkbench((state) => state.pending.has("projectMutating"));
  const choice = useProjectChoice(text(sessionRow?.projectId));
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!sessionRow) return;
    const resolved = choice.resolve();
    const project = resolved.name ? { id: makeId("project"), name: resolved.name } : resolved.project;
    await runDialogAction(() => actions.assignProject(project), onClose, setError, "项目归属保存失败。 ", "项目归属保存失败。 ");
  }
  return <form onSubmit={submit}><Stack gap="md"><ProjectSelector choice={choice} disabled={saving} /><FormError>{error}</FormError><Group justify="flex-end"><Button variant="default" onClick={onClose}>取消</Button><Button type="submit" loading={saving}>保存</Button></Group></Stack></form>;
}
