import { useState } from "react";
import { Button, Group, Select } from "@mantine/core";
import { NewProjectDialog } from "./NewProjectDialog.tsx";
import { DRAFT_PROJECT, type ProjectChoice } from "./use-project-choice.ts";

// A variable, not a literal: the test hook `data-action` is not part of Mantine's clear-button prop type.
const CLEAR_BUTTON = { "aria-label": "清除项目选择", "data-action": "clear-project" };

type ProjectSelectorProps = { choice: ProjectChoice; disabled: boolean };

export function ProjectSelector({ choice, disabled }: ProjectSelectorProps) {
  const { projects, selected, setSelected, draft, createDraft } = choice;
  const [opened, setOpened] = useState(false);
  const options = projects.map(({ id, name }) => ({ value: id, label: name }));
  if (draft) options.push({ value: DRAFT_PROJECT, label: draft });
  return <>
    <Group align="flex-end" gap="xs" wrap="nowrap" data-project-selector data-selected={selected === DRAFT_PROJECT ? "" : selected ?? ""} data-new-name={selected === DRAFT_PROJECT ? "true" : undefined}>
      <Select id="project-choice-select" label="选择项目" data={options} value={selected} onChange={setSelected} clearable disabled={disabled}
        clearButtonProps={CLEAR_BUTTON} flex={1}
        renderOption={({ option }) => <span data-project-option={option.value}>{option.label}</span>} />
      <Button variant="default" data-action="new-project" onClick={() => setOpened(true)} disabled={disabled}>新建项目</Button>
    </Group>
    <NewProjectDialog opened={opened} onClose={() => setOpened(false)} projects={projects} onConfirm={createDraft} />
  </>;
}
