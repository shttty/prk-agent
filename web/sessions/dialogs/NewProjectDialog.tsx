import { useState, type FormEvent } from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import type { ProjectPayload } from "../sidebar/sidebar-types.ts";
import { FormError } from "../../design-system/form-error/FormError.tsx";

type NewProjectDialogProps = { opened: boolean; onClose: () => void; projects: readonly ProjectPayload[]; onConfirm: (name: string) => void };

export function NewProjectDialog({ opened, onClose, projects, onConfirm }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  function close() { setName(""); setError(""); onClose(); }
  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const trimmed = name.trim();
    if (!trimmed) return setError("项目名称不能为空。");
    if (projects.some((project) => project.name === trimmed)) return setError(`已有项目「${trimmed}」。`);
    onConfirm(trimmed);
    close();
  }
  return <Modal stackId="new-project" id="new-project-dialog" opened={opened} onClose={close} title="新建项目" centered size={400} className="management-modal" closeButtonProps={{ "aria-label": "关闭新建项目对话框" }}>
    <form onSubmit={submit}>
      <Stack gap="md">
        <TextInput id="new-project-name" label="项目名称" value={name} maxLength={200} data-autofocus onChange={(event) => { setName(event.currentTarget.value); setError(""); }} />
        <FormError id="new-project-error">{error}</FormError>
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>取消</Button>
          <Button type="submit" data-action="confirm-new-project">确定</Button>
        </Group>
      </Stack>
    </form>
  </Modal>;
}
