import type { AskQuestion, HostedExtensionUiSnapshot } from "../../../src/gateway/wire/web-types.ts";

export type AskPrompt = HostedExtensionUiSnapshot["prompts"][number];
export type TextEntry = { text: string };
/** Where the note sits: the option row it belongs to, and what was typed. */
export type NoteEntry = { row: number | null; text: string };
/** What the user has entered for one question. */
export type Draft = { selected: number[]; pick: "option" | "other"; custom: TextEntry; note: NoteEntry };
/** The answer a draft amounts to once single-select exclusivity is applied. */
export type EffectiveAnswer = { selected: number[]; custom: TextEntry | null; note: NoteEntry | null };
export type AskState = { drafts: Record<string, Draft>; tab: number; cursors: Record<string, number> };
export type OpenField = { kind: "custom" | "note"; qid: string };
export type { AskQuestion };
