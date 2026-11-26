import type { KeyboardEvent, RefObject } from "react";
import { ActionIcon, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import { StaticMarkdown } from "../markdown/StaticMarkdown.tsx";
import { TextField } from "./TextField.tsx";
import { Mark } from "./Mark.tsx";
import type { AskQuestion, Draft, EffectiveAnswer, OpenField } from "./ask-types.ts";

type AskQuestionPanelProps = {
  id: string; position: number; question: AskQuestion; draft: Draft; answer: EffectiveAnswer; cursor: number; openField: OpenField | null;
  listRef: RefObject<HTMLDivElement | null>; onChoose: (row: number) => void; onToggleNote: (row: number) => void; onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onNoteText: (text: string) => void; onCustomText: (text: string) => void;
};

/** One question page: its options (with a note button each), the free-text "other" row and the highlighted option's preview. */
export function AskQuestionPanel({ id, position, question, draft, answer, cursor, openField, listRef, onChoose, onToggleNote, onKeyDown, onNoteText, onCustomText }: AskQuestionPanelProps) {
  const other = question.options.length;
  const active = question.options[cursor];
  const customOpen = openField?.kind === "custom" && openField.qid === question.id;
  const noteOpen = openField?.kind === "note" && openField.qid === question.id;
  const customText = answer.custom ? answer.custom.text.trim() : "";
  const multi = question.multi === true;
  const rowProps = { px: 10, py: { base: 9, sm: 7 }, gap: 10, wrap: "nowrap", align: "flex-start", flex: "1 1 auto", miw: 0 } as const;
  return <Stack className="pi-ask-panel" gap={8} role="tabpanel" data-ask-question={position}>
    <Text className="pi-ask-question" size="sm" fw={600}>{question.question}</Text>
    <SimpleGrid cols={{ base: 1, sm: active?.preview ? 2 : 1 }} spacing={12}>
      <Stack gap={8} miw={0}>
        <Stack ref={listRef} gap={2} className="pi-ask-list" role="listbox" tabIndex={0} aria-multiselectable={multi} aria-activedescendant={`${id}-row-${cursor}`} aria-label={question.question} onKeyDown={onKeyDown}>
          {question.options.map((option, row) => {
            const selected = answer.selected.includes(row);
            const recommended = question.recommended === row;
            const hasNote = draft.note.row === row && Boolean(draft.note.text.trim());
            return <Group key={row} gap={2} wrap="nowrap" align="stretch" className="pi-ask-row" role="presentation" data-active={cursor === row ? "true" : "false"} data-selected={selected ? "true" : "false"}>
              <Group id={`${id}-row-${row}`} role="option" className="pi-ask-option" data-ask-option={row} data-selected={selected ? "true" : "false"} data-recommended={recommended ? "true" : undefined} aria-selected={selected} onClick={() => onChoose(row)} {...rowProps}>
                <Mark multi={multi} on={selected} />
                <Stack gap={1} miw={0} fz={13.5} lh={1.45}>
                  <span className="pi-ask-option-label">{option.label}{recommended ? <span className="pi-ask-recommended">（推荐）</span> : null}</span>
                  {option.description ? <span className="pi-ask-option-description">{option.description}</span> : null}
                </Stack>
              </Group>
              <ActionIcon type="button" size="sm" variant="subtle" color="gray" className="pi-ask-note-button" data-action="ask-note" data-option={row} data-has-note={hasNote ? "true" : "false"} aria-label="备注" onClick={() => onToggleNote(row)} style={{ alignSelf: "center" }}><IconNotes size={16} stroke={1.7} /></ActionIcon>
            </Group>;
          })}
          <Group gap={2} wrap="nowrap" align="stretch" className="pi-ask-row" role="presentation" data-active={cursor === other ? "true" : "false"} data-selected={answer.custom ? "true" : "false"}>
            <Group id={`${id}-row-${other}`} role="option" className="pi-ask-option" data-ask-option="other" data-selected={answer.custom ? "true" : "false"} aria-selected={Boolean(answer.custom)} onClick={() => onChoose(other)} {...rowProps}>
              <Mark multi={multi} on={Boolean(answer.custom)} />
              <Stack gap={1} miw={0} fz={13.5} lh={1.45}><span className="pi-ask-option-label">其他…{customText ? <span className="pi-ask-custom-text">{customText}</span> : null}</span></Stack>
            </Group>
          </Group>
        </Stack>
        {noteOpen ? <TextField kind="note" value={draft.note} placeholder="备注" update={onNoteText} /> : null}
        {customOpen ? <TextField kind="custom" value={draft.custom} placeholder="输入回答" update={onCustomText} /> : null}
      </Stack>
      {active?.preview ? <aside className="pi-ask-preview" data-ask-preview={cursor}><StaticMarkdown text={active.preview} /></aside> : null}
    </SimpleGrid>
  </Stack>;
}
