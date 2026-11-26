import type { FormEvent } from "react";
import type { SavedPreset } from "./preset-types.ts";
import { useState } from "react";
import { Modal } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { layoutNameProblem } from "./layout-name-problem.ts";

const PROBLEMS: Record<"empty" | "taken", string> = { empty: "请输入名称。", taken: "已有同名布局。" };

type SaveLayoutDialogProps = { opened: boolean; saved: readonly SavedPreset[]; onCancel: () => void; onSave: (name: string) => void };

/** Name the current arrangement. An empty or taken name (built-in ones included) is refused with the reason. */
export function SaveLayoutDialog({ opened, saved, onCancel, onSave }: SaveLayoutDialogProps) {
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<"empty" | "taken" | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = layoutNameProblem(name, saved);
    if (found) { setProblem(found); return; }
    onSave(name.trim());
    setName("");
    setProblem(null);
  };
  return <Modal id="save-layout-dialog" opened={opened} onClose={() => { setProblem(null); onCancel(); }} title="保存当前布局" size="sm" centered>
    <form onSubmit={submit}>
      <TextInput id="layout-name" data-autofocus label="名称" value={name} error={problem ? PROBLEMS[problem] : null} data-problem={problem ?? undefined}
        onChange={(event) => { setName(event.currentTarget.value); setProblem(null); }} />
      <Group justify="flex-end" gap="xs" mt="md">
        <Button variant="default" data-action="cancel" onClick={() => { setProblem(null); onCancel(); }}>取消</Button>
        <Button id="confirm-save-layout" type="submit">保存</Button>
      </Group>
    </form>
  </Modal>;
}
