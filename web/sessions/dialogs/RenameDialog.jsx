import { useState } from "react";
import { text } from "../sidebar/text.js";
import { runDialogAction } from "./run-dialog-action.js";
import { Stack } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
export function RenameDialog({ actions, onClose, sessionRow, project }) {
  const renaming = useWorkbench((state) => state.session.pending.has("renaming"));
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(project?.name ?? (text(sessionRow?.label) || text(sessionRow?.sessionId)));
  const field = project ? "项目名称" : "会话名称";
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!label.trim()) return setError(`${field}不能为空。`);
    if (project ? saving : renaming) return;
    const failure = `${field}保存失败。`;
    if (project) setSaving(true);
    try {
      await runDialogAction(() => project ? actions.renameProject(project.id, label.trim()) : actions.renameSession(label.trim()), onClose, setError, failure, failure);
    } finally { if (project) setSaving(false); }
  }
  return <form onSubmit={submit}><Stack gap="md"><TextInput id={project ? "project-rename-name" : undefined} label={field} value={label} onChange={(event) => setLabel(event.currentTarget.value)} maxLength={200} autoFocus /><FormError>{error}</FormError><Group justify="flex-end"><Button variant="default" onClick={onClose}>取消</Button><Button data-action={project ? "save-project-name" : undefined} type="submit" loading={project ? saving : renaming}>保存</Button></Group></Stack></form>;
}
