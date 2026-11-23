import "./ask.css";
import { useState } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useEffectEvent } from "react";
import { Tabs } from "@mantine/core";
import { Text } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Button } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { Countdown } from "../extension-ui/Countdown.jsx";
import { StaticMarkdown } from "../markdown/StaticMarkdown.jsx";
import { blankDraft } from "./answers/blank-draft.js";
import { isDirect } from "./answers/is-direct.js";
import { effectiveAnswer } from "./answers/effective-answer.js";
import { isAnswered } from "./answers/is-answered.js";
import { selectOption } from "./answers/select-option.js";
import { noteOn } from "./answers/note-on.js";
import { tabLabel } from "./answers/tab-label.js";
import { setCustom } from "./answers/set-custom.js";
import { answersPayload } from "./answers/answers-payload.js";
import { saved } from "./ask-draft-memory.js";
import { keyOf } from "./ask-draft-memory.js";
import { clamp } from "./clamp.js";
import { TextField } from "./TextField.jsx";
import { Mark } from "./Mark.jsx";
import { AnswerSummary } from "./AnswerSummary.jsx";
export function AskDialog({ prompt, sessionKey, onAction, onStop }) {
  const id = String(prompt.id);
  const questions = Array.isArray(prompt.questions) ? prompt.questions : [];
  const key = keyOf(sessionKey, id);
  const [state, setState] = useState(() => saved.get(key) ?? {
    drafts: Object.fromEntries(questions.map((question) => [question.id, blankDraft()])),
    tab: 0,
    // The highlighted row (not the answer): the recommended option when there is one.
    cursors: Object.fromEntries(questions.map((question) => [question.id, question.recommended ?? 0])),
  });
  const { drafts, tab, cursors } = state;
  useEffect(() => { saved.set(key, state); }, [key, state]);
  const [openField, setOpenField] = useState(null); // { kind: "custom" | "note", qid }
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);
  const submitRef = useRef(null);
  const tabsRef = useRef(null);

  // Tabs are the questions by position, then the review tab at `questions.length`; one single-select question has
  // no review tab, its page submits.
  const direct = isDirect(questions);
  const tabCount = direct ? 1 : questions.length + 1;
  const reviewing = !direct && tab >= questions.length;
  const go = (target) => { setOpenField(null); setState((previous) => ({ ...previous, tab: target })); };
  const step = (delta) => go((tab + delta + tabCount) % tabCount);
  const setDraft = (qid, change) => setState((previous) => ({ ...previous, drafts: { ...previous.drafts, [qid]: change(previous.drafts[qid]) } }));
  const setCursor = (qid, value) => setState((previous) => ({ ...previous, cursors: { ...previous.cursors, [qid]: value } }));

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

  const answers = questions.map((question) => effectiveAnswer(question, drafts[question.id]));
  const unanswered = answers.filter((answer) => !isAnswered(answer)).length;

  const send = async (args) => {
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

  const question = reviewing ? null : questions[tab];
  const draft = question ? drafts[question.id] : null;
  const other = question ? question.options.length : 0;
  const cursor = question ? clamp(cursors[question.id], 0, other) : 0;

  const choose = (row) => {
    setCursor(question.id, row);
    if (row === other) {
      setOpenField((current) => (current?.kind === "custom" && current.qid === question.id ? null : { kind: "custom", qid: question.id }));
      setDraft(question.id, (value) => (value.custom.text.trim() ? { ...value, pick: "other" } : value));
      return;
    }
    setDraft(question.id, (value) => selectOption(question, value, row));
    listRef.current?.focus({ preventScroll: true });
  };
  const toggleNote = (row) => {
    setCursor(question.id, row);
    setOpenField((current) => (current?.kind === "note" && current.qid === question.id && draft.note.row === row ? null : { kind: "note", qid: question.id }));
    setDraft(question.id, (value) => noteOn(value, row));
  };
  const onListKey = (event) => {
    if (event.target !== event.currentTarget) return;
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

  const active = question?.options[cursor];
  const customOpen = openField?.kind === "custom" && openField.qid === question?.id;
  const noteOpen = openField?.kind === "note" && openField.qid === question?.id;
  const answer = question ? answers[tab] : null;
  const customText = answer?.custom ? answer.custom.text.trim() : "";

  return <div className="extension-ui-prompt extension-ui-prompt-ask pi-ask" tabIndex={-1} data-prompt-id={id} data-prompt-kind="ask" data-ask-id={id} data-ask-tab={reviewing ? "review" : String(tab)} data-submitting={submitting ? "true" : undefined}>
    {direct && !prompt.expiresAt ? null : <div className="pi-ask-head">
      {direct ? <span /> : <Tabs value={reviewing ? "review" : String(tab)} onChange={(value) => go(value === "review" ? questions.length : Number(value))} variant="pills" radius="xl" color="accent" styles={{ tab: { padding: "4px 11px", fontSize: "var(--mantine-font-size-xs)", maxWidth: "14rem" } }}>
        <Tabs.List ref={tabsRef} className="pi-ask-tabs">
          {questions.map((item, position) => <Tabs.Tab key={item.id} value={String(position)} className="pi-ask-tab" data-ask-tab-button={position} data-answered={isAnswered(answers[position]) ? "true" : "false"} leftSection={<StatusDot tone={isAnswered(answers[position]) ? "ok" : "idle"} size={6} />}>{tabLabel(item, position)}</Tabs.Tab>)}
          <Tabs.Tab value="review" className="pi-ask-tab" data-ask-tab-button="review">汇总</Tabs.Tab>
        </Tabs.List>
      </Tabs>}
      <Countdown expiresAt={prompt.expiresAt} label={(seconds) => `${seconds} 秒后自动选择`} />
    </div>}

    {question ? <div className="pi-ask-panel" role="tabpanel" data-ask-question={tab}>
      <Text className="pi-ask-question" size="sm" fw={600}>{question.question}</Text>
      <div className="pi-ask-body">
        <div className="pi-ask-options">
          <div ref={listRef} className="pi-ask-list" role="listbox" tabIndex={0} aria-multiselectable={question.multi === true} aria-activedescendant={`${id}-row-${cursor}`} aria-label={question.question} onKeyDown={onListKey}>
            {question.options.map((option, row) => {
              const selected = answer.selected.includes(row);
              const recommended = question.recommended === row;
              const hasNote = draft.note.row === row && Boolean(draft.note.text.trim());
              return <div key={row} className="pi-ask-row" role="presentation" data-active={cursor === row ? "true" : "false"} data-selected={selected ? "true" : "false"}>
                <div id={`${id}-row-${row}`} role="option" className="pi-ask-option" data-ask-option={row} data-selected={selected ? "true" : "false"} data-recommended={recommended ? "true" : undefined} aria-selected={selected} onClick={() => choose(row)}>
                  <Mark multi={question.multi === true} on={selected} />
                  <span className="pi-ask-option-body">
                    <span className="pi-ask-option-label">{option.label}{recommended ? <span className="pi-ask-recommended">（推荐）</span> : null}</span>
                    {option.description ? <span className="pi-ask-option-description">{option.description}</span> : null}
                  </span>
                </div>
                <ActionIcon type="button" size="sm" variant="subtle" color="gray" className="pi-ask-note-button" data-action="ask-note" data-option={row} data-has-note={hasNote ? "true" : "false"} aria-label="备注" onClick={() => toggleNote(row)}><IconNotes size={16} stroke={1.7} /></ActionIcon>
              </div>;
            })}
            <div className="pi-ask-row" role="presentation" data-active={cursor === other ? "true" : "false"} data-selected={answer.custom ? "true" : "false"}>
              <div id={`${id}-row-${other}`} role="option" className="pi-ask-option" data-ask-option="other" data-selected={answer.custom ? "true" : "false"} aria-selected={Boolean(answer.custom)} onClick={() => choose(other)}>
                <Mark multi={question.multi === true} on={Boolean(answer.custom)} />
                <span className="pi-ask-option-body"><span className="pi-ask-option-label">其他…{customText ? <span className="pi-ask-custom-text">{customText}</span> : null}</span></span>
              </div>
            </div>
          </div>
          {noteOpen ? <TextField kind="note" value={draft.note} placeholder="备注" update={(change) => setDraft(question.id, (value) => ({ ...value, note: change(value.note) }))} /> : null}
          {customOpen ? <TextField kind="custom" value={draft.custom} placeholder="输入回答" update={(change) => setDraft(question.id, (value) => setCustom(value, change(value.custom)))} /> : null}
        </div>
        {active?.preview ? <aside className="pi-ask-preview" data-ask-preview={cursor}><StaticMarkdown text={active.preview} /></aside> : null}
      </div>
    </div> : <div className="pi-ask-panel pi-ask-review" role="tabpanel" data-ask-unanswered={unanswered}>
      {questions.map((item, position) => <button key={item.id} type="button" className="pi-ask-review-row" data-ask-review={position} data-answered={isAnswered(answers[position]) ? "true" : "false"} onClick={() => go(position)}>
        <span className="pi-ask-review-question">{tabLabel(item, position)}</span>
        {isAnswered(answers[position]) ? <AnswerSummary question={item} answer={answers[position]} /> : <span className="pi-ask-review-answer is-missing">未回答</span>}
      </button>)}
      {unanswered ? <Text className="pi-ask-review-warning" size="xs" c="dimmed">{unanswered} 题未回答</Text> : null}
    </div>}

    <div className="pi-ask-footer">
      <div className="pi-ask-footer-side">
        <Button size="compact-sm" variant="subtle" color="gray" data-action="ask-chat" disabled={submitting} onClick={() => void send({ chat: true })}>先聊聊</Button>
        <Button size="compact-sm" variant="default" data-action="ask-cancel" disabled={submitting} onClick={() => void cancel()}>取消</Button>
      </div>
      {question && !direct
        ? <Button size="compact-sm" data-action="ask-next" onClick={() => step(1)}>下一步</Button>
        : <Button ref={submitRef} size="compact-sm" data-action="ask-submit" loading={submitting} disabled={direct && !isAnswered(answers[0])} onClick={() => void send({ answers: answersPayload(questions, drafts) })}>提交</Button>}
    </div>
  </div>;
}
