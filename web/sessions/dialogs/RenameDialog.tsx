import { useState, type FormEvent } from "react";
import { runDialogAction } from "./run-dialog-action.ts";
import { Stack } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { SessionRow } from "../../workbench/store/store-types.ts";
import type { ProjectPayload } from "../sidebar/sidebar-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
type RenameDialogProps = { actions: WorkbenchActions; onClose: () => void; sessionRow: SessionRow | undefined; project?: ProjectPayload };

export function RenameDialog({ actions, onClose, sessionRow, project }: RenameDialogProps) {
  const renaming = useWorkbench((state: WorkbenchState) => state.session.pending.has("renaming"));
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(project?.name ?? (sessionRow?.label || sessionRow?.sessionId || ""));
  const field = project ? "项目名称" : "会话名称";
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) return setError(`${field}不能为空。`);
    if (project ? saving : renaming) return;
    const failure = `${field}保存失败。`;
    if (project) setSaving(true);
    try {
      await runDialogAction(() => project ? actions.renameProject(project.id, label.trim()) : actions.renameSession(label.trim()), onClose, setError, failure, failure);
    } finally { if (project) setSaving(false); }
  }
  return <form onSubmit={(event) => void submit(event)}><Stack gap="md"><TextInput id={project ? "project-rename-name" : undefined} label={field} value={label} onChange={(event) => setLabel(event.currentTarget.value)} maxLength={200} autoFocus /><FormError>{error}</FormError><Group justify="flex-end"><Button variant="default" onClick={onClose}>取消</Button><Button data-action={project ? "save-project-name" : undefined} type="submit" loading={project ? saving : renaming}>保存</Button></Group></Stack></form>;
}
