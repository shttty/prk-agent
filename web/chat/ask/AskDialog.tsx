import "./ask.css";
import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useEffectEvent } from "react";
import { Button, Group, Stack, Tabs } from "@mantine/core";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { Countdown } from "../extension-ui/Countdown.tsx";
import { blankDraft } from "./answers/blank-draft.ts";
import { isDirect } from "./answers/is-direct.ts";
import { effectiveAnswer } from "./answers/effective-answer.ts";
import { isAnswered } from "./answers/is-answered.ts";
import { selectOption } from "./answers/select-option.ts";
import { noteOn } from "./answers/note-on.ts";
import { tabLabel } from "./answers/tab-label.ts";
import { setCustom } from "./answers/set-custom.ts";
import { answersPayload } from "./answers/answers-payload.ts";
import { saved } from "./ask-draft-memory.ts";
import { keyOf } from "./ask-draft-memory.ts";
import { clamp } from "./clamp.ts";
import { AskQuestionPanel } from "./AskQuestionPanel.tsx";
import { AskReview } from "./AskReview.tsx";
import type { AskPrompt, AskState, Draft, OpenField } from "./ask-types.ts";

type AskDialogProps = { prompt: AskPrompt; sessionKey: string; onAction: (args: Record<string, unknown>) => Promise<unknown>; onStop: () => unknown };

export function AskDialog({ prompt, sessionKey, onAction, onStop }: AskDialogProps) {
  const id = String(prompt.id);
  const questions = prompt.questions ?? [];
  const key = keyOf(sessionKey, id);
  const [state, setState] = useState<AskState>(() => saved.get(key) ?? {
    drafts: Object.fromEntries(questions.map((question) => [question.id, blankDraft()])),
    tab: 0,
    // The highlighted row (not the answer): the recommended option when there is one.
    cursors: Object.fromEntries(questions.map((question) => [question.id, question.recommended ?? 0])),
  });
  const { drafts, tab, cursors } = state;
  useEffect(() => { saved.set(key, state); }, [key, state]);
  const [openField, setOpenField] = useState<OpenField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Tabs are the questions by position, then the review tab at `questions.length`; one single-select question has
  // no review tab, its page submits.
  const direct = isDirect(questions);
  const tabCount = direct ? 1 : questions.length + 1;
  const go = (target: number) => { setOpenField(null); setState((previous) => ({ ...previous, tab: target })); };
  const step = (delta: number) => go((tab + delta + tabCount) % tabCount);
  const setDraft = (qid: string, change: (draft: Draft) => Draft) => setState((previous) => ({ ...previous, drafts: { ...previous.drafts, [qid]: change(previous.drafts[qid] ?? blankDraft()) } }));
  const setCursor = (qid: string, value: number) => setState((previous) => ({ ...previous, cursors: { ...previous.cursors, [qid]: value } }));

  // Focus follows the tab (so arrows work at once), but a freshly raised card never takes focus from the composer.
  const mounted = useRef(false);
  const focusPanel = useEffectEvent(() => { (listRef.current ?? submitRef.current)?.focus({ preventScroll: true }); });
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (first && document.activeElement && document.activeElement !== document.body) return;
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    focusPanel();
  }, [tab]);

  const answers = questions.map((question) => effectiveAnswer(question, drafts[question.id] ?? blankDraft()));
  const unanswered = answers.filter((answer) => !isAnswered(answer)).length;

  const send = async (args: Record<string, unknown>) => {
    setSubmitting(true);
    const result = await onAction({ operation: "dialog", id, ...args });
    setSubmitting(false);
    if (result) saved.delete(key);
  };
  // Cancel stops the turn exactly as the composer's stop button does (which also closes this dialog). With no
  // operation the page knows of to stop, it only closes the dialog.
  const cancel = async () => {
    setSubmitting(true);
    const closed = (await onStop()) || Boolean(await onAction({ operation: "dialog", id, cancel: true }));
    setSubmitting(false);
    if (closed) saved.delete(key);
  };

  const question = direct || tab < questions.length ? questions[tab] : undefined;
  const draft = question ? drafts[question.id] ?? blankDraft() : blankDraft();
  const answer = question ? answers[tab] : undefined;
  const other = question ? question.options.length : 0;
  const cursor = question ? clamp(cursors[question.id] ?? 0, 0, other) : 0;
  const reviewing = !question;

  const choose = (row: number) => {
    if (!question) return;
    setCursor(question.id, row);
    if (row === other) {
      setOpenField((current) => (current?.kind === "custom" && current.qid === question.id ? null : { kind: "custom", qid: question.id }));
      setDraft(question.id, (value) => (value.custom.text.trim() ? { ...value, pick: "other" } : value));
      return;
    }
    setDraft(question.id, (value) => selectOption(question, value, row));
    listRef.current?.focus({ preventScroll: true });
  };
  const toggleNote = (row: number) => {
    if (!question) return;
    setCursor(question.id, row);
    setOpenField((current) => (current?.kind === "note" && current.qid === question.id && draft.note.row === row ? null : { kind: "note", qid: question.id }));
    setDraft(question.id, (value) => noteOn(value, row));
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!question || event.target !== event.currentTarget) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setCursor(question.id, clamp(cursor + (event.key === "ArrowDown" ? 1 : -1), 0, other)); }
    else if (!direct && event.key === "ArrowRight") { event.preventDefault(); step(1); }
    else if (!direct && event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (!direct && event.key === "Tab") { event.preventDefault(); step(event.shiftKey ? -1 : 1); }
    else if (event.key === " ") { event.preventDefault(); choose(cursor); }
    else if (event.key === "Enter") {
      event.preventDefault();
      if (cursor === other) choose(cursor);
      else {
        // Enter confirms: a single-select question takes the highlighted option, a multi-select one keeps what is ticked.
        if (question.multi !== true) setDraft(question.id, (value) => selectOption(question, value, cursor));
        if (!direct) step(1);
      }
    }
  };

  return <Stack gap={10} className="extension-ui-prompt extension-ui-prompt-ask pi-ask" tabIndex={-1} data-prompt-id={id} data-prompt-kind="ask" data-ask-id={id} data-ask-tab={reviewing ? "review" : String(tab)} data-submitting={submitting ? "true" : undefined}>
    {direct && !prompt.expiresAt ? null : <Group justify="space-between" wrap="nowrap" gap={10} miw={0}>
      {direct ? <span /> : <Tabs value={reviewing ? "review" : String(tab)} onChange={(value) => go(value === "review" ? questions.length : Number(value))} variant="pills" radius="xl" color="accent" miw={0} styles={{ tab: { padding: "4px 11px", fontSize: "var(--mantine-font-size-xs)", maxWidth: "14rem" } }}>
        <Tabs.List ref={tabsRef} className="pi-ask-tabs">
          {questions.map((item, position) => {
            const answered = Boolean(answers[position] && isAnswered(answers[position]));
            return <Tabs.Tab key={item.id} value={String(position)} className="pi-ask-tab" data-ask-tab-button={position} data-answered={answered ? "true" : "false"} leftSection={<StatusDot tone={answered ? "ok" : "idle"} size={6} />}>{tabLabel(item, position)}</Tabs.Tab>;
          })}
          <Tabs.Tab value="review" className="pi-ask-tab" data-ask-tab-button="review">汇总</Tabs.Tab>
        </Tabs.List>
      </Tabs>}
      <Countdown expiresAt={prompt.expiresAt} label={(seconds) => `${seconds} 秒后自动选择`} />
    </Group>}

    {question && answer
      ? <AskQuestionPanel id={id} position={tab} question={question} draft={draft} answer={answer} cursor={cursor} openField={openField} listRef={listRef}
        onChoose={choose} onToggleNote={toggleNote} onKeyDown={onListKey}
        onNoteText={(text) => setDraft(question.id, (value) => ({ ...value, note: { ...value.note, text } }))}
        onCustomText={(text) => setDraft(question.id, (value) => setCustom(value, { ...value.custom, text }))} />
      : <AskReview questions={questions} answers={answers} unanswered={unanswered} onOpen={go} />}

    <Group justify="space-between" gap={8} wrap="nowrap">
      <Group gap={6} wrap="nowrap">
        <Button size="compact-sm" variant="subtle" color="gray" data-action="ask-chat" disabled={submitting} onClick={() => void send({ chat: true })}>先聊聊</Button>
        <Button size="compact-sm" variant="default" data-action="ask-cancel" disabled={submitting} onClick={() => void cancel()}>取消</Button>
      </Group>
      {question && !direct
        ? <Button size="compact-sm" data-action="ask-next" onClick={() => step(1)}>下一步</Button>
        : <Button ref={submitRef} size="compact-sm" data-action="ask-submit" loading={submitting} disabled={direct && !(answers[0] && isAnswered(answers[0]))} onClick={() => void send({ answers: answersPayload(questions, drafts) })}>提交</Button>}
    </Group>
  </Stack>;
}
