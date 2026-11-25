import "./tool-body.css";
import { ExtensionNode } from "../../../extension-ui/ExtensionNode.jsx";
import { CodeBlock } from "../../../code/CodeBlock.jsx";
import { DiffBlock } from "../../../code/DiffBlock.jsx";
import { nestedSummary } from "../../../tool-text/nested-summary.js";
import { askRecord } from "../../../tool-text/ask-record.js";
import { splitReadNotice } from "../../../tool-text/split-read-notice.js";
import { bashMeta } from "../../../tool-text/bash-meta.js";
import { NestedCalls } from "./NestedCalls.jsx";
import { AskRecord } from "./AskRecord.jsx";
import { sessionListRows } from "../../../tool-text/session-list-rows.js";
import { SessionListResult } from "./SessionListResult.jsx";
import { ResultImages } from "./ResultImages.jsx";
export const NO_INPUT = "（无输入）";

/**
 * `args` is the parsed JSON arguments (null while unreadable), `code` their text; `output` the result text and
 * `outputText` the same with the waiting/unknown placeholder; `result` the result message (carries `nestedCalls`).
 * `active` is the row's open state: syntax highlighting waits for it.
 */
export function ToolBody({ kind, toolCallId, showResultImages, args, code, output, outputText, result, toolState, parsedDiff, extensionTool, headerOnlyCall, active, contentMetadata, loadContent }) {
  const inputDeferred = contentMetadata?.inputLoaded ? undefined : contentMetadata?.inputPreview;
  const outputDeferred = contentMetadata?.outputLoaded ? undefined : contentMetadata?.outputPreview;
  const inputOptions = { deferred: inputDeferred, loadContent, ...(contentMetadata?.inputLoaded ? { limit: Infinity } : {}) };
  const outputOptions = { deferred: outputDeferred, loadContent, ...(contentMetadata?.outputLoaded ? { limit: Infinity } : {}) };
  const nested = nestedSummary(result);
  const record = kind === "ask" ? askRecord(args, result) : null;
  const nestedNode = nested.length ? <NestedCalls calls={nested} /> : null;
  // Arguments that parse are shown as highlighted JSON; half-streamed text stays plain.
  const genericInput = <CodeBlock code={code || NO_INPUT} query={args ? { name: "json" } : undefined} active={active} {...inputOptions} />;
  const plainOutput = <CodeBlock output code={outputText} active={active} {...outputOptions} />;

  if (!inputDeferred && !outputDeferred && (extensionTool?.call || extensionTool?.result)) {
    return <>
      {extensionTool.call ? (headerOnlyCall ? null : <ExtensionNode node={extensionTool.call} className="extension-tool-call" />) : genericInput}
      {extensionTool.result ? <ExtensionNode node={extensionTool.result} className="extension-tool-result" /> : plainOutput}
      {nestedNode}
    </>;
  }

  const done = toolState === "done";
  const input = inputDeferred ? genericInput : kind === "read" || kind === "session_list" ? null
    : kind === "ask" ? <AskRecord record={record} />
    : kind === "kernel_code" ? <CodeBlock code={code} query={{ name: "python" }} mode="numbers" active={active} {...inputOptions} />
    : kind === "bash" ? <CodeBlock code={args.command} query={{ name: "shell" }} mode="prompt" active={active} {...inputOptions} />
    : kind === "write" ? <CodeBlock code={args.content} query={{ filename: args.path }} mode="numbers" active={active} {...inputOptions} />
    : parsedDiff ? <DiffBlock diff={parsedDiff} query={{ filename: args.path }} active={active} {...(contentMetadata?.outputLoaded ? { limit: Infinity } : {})} />
    : genericInput;

  // A finished write/edit has nothing to report beyond its input (write: Pi's own one-line result, faint).
  let note = "";
  let outputNode = plainOutput;
  if (outputDeferred) { /* The preview must remain reachable even for write/edit/ask results. */ }
  else if (done && kind === "write") { outputNode = null; note = output.trim(); }
  else if (done && kind === "edit" && parsedDiff) outputNode = null;
  else if (record && record.outcome !== "unknown") outputNode = null;
  else if (done && kind === "session_list") {
    const sessions = sessionListRows(result);
    if (sessions) outputNode = <SessionListResult rows={sessions} />;
  }
  else if (done && kind === "read" && output) {
    const split = splitReadNotice(output);
    const offset = Math.floor(Number(args.offset));
    outputNode = <>
      {split.body ? <CodeBlock output code={split.body} query={{ filename: args.path }} mode="numbers" start={offset >= 1 ? offset : 1} active={active} {...outputOptions} /> : null}
      {split.notice ? <div className="pi-io-note" data-kind="read-notice">{split.notice}</div> : null}
    </>;
  }
  const meta = kind === "bash" ? bashMeta(args) : "";

  return (
    <div className="pi-io" data-kind={kind}>
      {input}
      {outputNode ? <>
        {input ? <div className="pi-io-rule" aria-hidden="true"><span>Output</span></div> : null}
        {outputNode}
      </> : null}
      {showResultImages ? <ResultImages toolCallId={toolCallId} result={result} /> : null}
      {note ? <div className="pi-io-note" data-kind="write-result">{note}</div> : null}
      {meta ? <div className="pi-io-note" data-kind="meta" data-timeout-seconds={Number(args.timeout)}>{meta}</div> : null}
      {nestedNode}
    </div>
  );
}
