import { useState } from "react";
import { Button, Group, Select } from "@mantine/core";
import { NewProjectDialog } from "./NewProjectDialog.jsx";
import { DRAFT_PROJECT } from "./use-project-choice.js";

export function ProjectSelector({ choice, disabled }) {
  const { projects, selected, setSelected, draft, createDraft } = choice;
  const [opened, setOpened] = useState(false);
  const options = projects.map(({ id, name }) => ({ value: id, label: name }));
  if (draft) options.push({ value: DRAFT_PROJECT, label: draft });
  return <>
    <Group align="flex-end" gap="xs" wrap="nowrap" data-project-selector data-selected={selected === DRAFT_PROJECT ? "" : selected ?? ""} data-new-name={selected === DRAFT_PROJECT ? "true" : undefined}>
      <Select id="project-choice-select" label="选择项目" data={options} value={selected} onChange={setSelected} clearable disabled={disabled}
        clearButtonProps={{ "aria-label": "清除项目选择", "data-action": "clear-project" }} flex={1}
        renderOption={({ option }) => <span data-project-option={option.value}>{option.label}</span>} />
      <Button variant="default" data-action="new-project" onClick={() => setOpened(true)} disabled={disabled}>新建项目</Button>
    </Group>
    <NewProjectDialog opened={opened} onClose={() => setOpened(false)} projects={projects} onConfirm={createDraft} />
  </>;
}
