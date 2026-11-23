import assert from "node:assert/strict";
import { askRecord } from "../../web/chat/tool-text/ask-record.js";
import { bashMeta } from "../../web/chat/tool-text/bash-meta.js";
import { nestedSummary } from "../../web/chat/tool-text/nested-summary.js";
import { parseDiff } from "../../web/chat/tool-text/parse-diff.js";
import { parseToolArgs } from "../../web/chat/tool-text/parse-tool-args.js";
import { splitReadNotice } from "../../web/chat/tool-text/split-read-notice.js";
import { splitRows } from "../../web/chat/tool-text/split-rows.js";
import { toolHeadline } from "../../web/chat/tool-text/tool-headline.js";
import { toolKind } from "../../web/chat/tool-text/tool-kind.js";

// parseDiff: Pi's edit `details.diff` (`<+|-| ><right-aligned number> <text>`, blank number + `...` = skipped lines).
const diff = ["  1 keep", "- 2 old", "+ 2 new", "+ 3 added", "    ...", " 40 tail"].join("\n");
const parsed = parseDiff(diff);
assert.deepEqual([parsed.add, parsed.del, parsed.rows.map((row) => row.kind)], [2, 1, ["ctx", "del", "add", "add", "gap", "ctx"]]);
assert.deepEqual(parsed.rows.map((row) => row.label), ["1", "-2", "+2", "+3", "…", "40"]);
assert.equal(parsed.rows[1].text, "old", "text starts after the number column");
assert.equal(parseDiff(["+ 1 a\r", "- 2 b\r"].join("\n")).rows[0].text, "a", "CRLF diffs drop the carriage return");
assert.equal(parseDiff(""), null, "empty diff");
assert.equal(parseDiff("not a diff at all"), null, "non-Pi text falls back to null");
assert.equal(parseDiff("+1 x\n-1 y").rows.length, 2, "narrow number column");

// parseToolArgs / toolKind: unreadable (streaming) arguments never produce a structured body.
assert.equal(parseToolArgs('{"command": "ls'), null, "half-streamed JSON");
assert.equal(parseToolArgs("[1]"), null, "non-object JSON");
assert.deepEqual(parseToolArgs('{"a":1}'), { a: 1 });
assert.equal(toolKind("bash", null, '{"command": "ls'), "generic");
assert.equal(toolKind("bash", { command: "ls" }, ""), "bash");
assert.equal(toolKind("bash", { command: "" }, ""), "generic");
assert.equal(toolKind("kernel_code", null, "x = 1"), "kernel_code", "kernel_code input is raw code, not JSON");
assert.equal(toolKind("write", { path: "a.ts" }, ""), "generic", "write without content");
assert.equal(toolKind("write", { path: "a.ts", content: "" }, ""), "write", "empty file is still a write");
assert.equal(toolKind("edit", { path: "a.ts" }, ""), "edit");
assert.equal(toolKind("read", { path: "" }, ""), "generic");
assert.equal(toolKind("web_search", { query: "x" }, ""), "generic");

// Header text: bash keeps the command out of the header; read shows the offset; generic is one compact JSON line.
assert.equal(toolHeadline("bash", { command: "ls" }, ""), "");
assert.equal(toolHeadline("read", { path: "a.ts", offset: 10 }, ""), "a.ts:10");
assert.equal(toolHeadline("read", { path: "a.ts", offset: 1 }, ""), "a.ts");
assert.equal(toolHeadline("edit", { path: "a.ts", offset: 10 }, ""), "a.ts", "offset only matters for read");
assert.equal(toolHeadline("generic", { query: "x", limit: 3 }, ""), '{"query":"x","limit":3}');
assert.equal(toolHeadline("generic", null, '{"query": "x'), '{"query": "x', "streaming text stays as is");
assert.ok(toolHeadline("generic", { text: "x".repeat(400) }, "").length <= 161, "header line is bounded");

// bash meta: Timeout only when the call passed one.
assert.equal(bashMeta({ command: "ls" }), "");
assert.ok(bashMeta({ timeout: 300 }), "a positive timeout produces metadata");
assert.equal(bashMeta({ command: "ls", timeout: 0 }), "");

// Pi's read continuation notices come off the file text; real file text that merely looks similar stays.
const file = "a\nb";
assert.deepEqual(splitReadNotice(`${file}\n\n[Showing lines 1-2 of 90. Use offset=3 to continue.]`), { body: file, notice: "[Showing lines 1-2 of 90. Use offset=3 to continue.]" });
assert.deepEqual(splitReadNotice(`${file}\n\n[Showing lines 1-2 of 90 (50.0KB limit). Use offset=3 to continue.]`).notice, "[Showing lines 1-2 of 90 (50.0KB limit). Use offset=3 to continue.]");
assert.deepEqual(splitReadNotice(`${file}\n\n[40 more lines in file. Use offset=3 to continue.]`).notice, "[40 more lines in file. Use offset=3 to continue.]");
assert.deepEqual(splitReadNotice("[Line 7 is 80KB, exceeds 50KB limit. Use bash: sed -n '7p' f | head -c 51200]"), { body: "", notice: "[Line 7 is 80KB, exceeds 50KB limit. Use bash: sed -n '7p' f | head -c 51200]" });
assert.deepEqual(splitReadNotice(file), { body: file, notice: "" });
assert.equal(splitReadNotice("[Showing lines 1-2 of 90. Use offset=3 to continue.]\n\nmore text").notice, "", "a notice-like line inside the file is not a tail");
assert.equal(splitReadNotice("").body, "");

// nestedSummary: one entry per tool name in first-call order, counted, failed if any call failed.
const calls = [{ name: "web_search", status: "ok" }, { name: "fetch_content", status: "ok" }, { name: "web_search", status: "error" }, { name: "todo_list", status: "unfinished" }];
assert.deepEqual(nestedSummary({ nestedCalls: { calls, complete: true } }), [
  { name: "web_search", count: 2, failed: true }, { name: "fetch_content", count: 1, failed: false }, { name: "todo_list", count: 1, failed: false },
]);
assert.deepEqual(nestedSummary({}), [], "no record");
assert.deepEqual(nestedSummary({ nestedCalls: [{ name: "x" }] }), [], "not the SDK record shape");
assert.deepEqual(nestedSummary({ nestedCalls: { calls: [{ status: "ok" }, null], complete: false } }), [], "nameless entries are skipped");
assert.deepEqual(nestedSummary("plain string result"), [], "live string results carry no record");

// splitRows: a final newline is not an extra row.
assert.deepEqual(splitRows("a\nb\n"), { rows: ["a", "b"], trailing: true });
assert.deepEqual(splitRows(""), { rows: [""], trailing: false });
assert.deepEqual(splitRows("\n"), { rows: [""], trailing: true });
assert.deepEqual(splitRows("a\n\nb"), { rows: ["a", "", "b"], trailing: false });

// ask: a structured body only for a readable call with questions; the record reads call arguments + the result's details.
const askArgs = { questions: [{ id: "db", header: "Storage", question: "Which database?", options: [{ label: "A" }, { label: "B" }] }, { id: "tz", question: "Zone?", options: [] }] };
assert.equal(toolKind("ask", askArgs, ""), "ask");
assert.equal(toolKind("ask", { questions: [] }, ""), "generic", "no questions");
assert.equal(toolKind("ask", null, '{"questions": [{"id'), "generic", "half-streamed call");
assert.equal(toolHeadline("ask", askArgs, ""), "Which database? · Zone?");
const answered = { details: { outcome: "answers", answers: [{ id: "db", selected: ["B"], custom: "own", note: "why" }, { id: "tz", selected: [], autoSelected: true }] } };
assert.deepEqual(askRecord(askArgs, answered), {
  outcome: "answers",
  rows: [
    { id: "db", label: "Storage", question: "Which database?", answer: { selected: ["B"], custom: "own", note: "why", auto: false, answered: true } },
    { id: "tz", label: "", question: "Zone?", answer: { selected: [], custom: "", note: "", auto: true, answered: false } },
  ],
});
assert.equal(askRecord(askArgs, undefined).outcome, "waiting", "no result yet");
assert.equal(askRecord(askArgs, undefined).rows[0].answer, null);
assert.equal(askRecord(askArgs, { details: { outcome: "chat" } }).outcome, "chat");
assert.equal(askRecord(askArgs, { details: { outcome: "cancelled" } }).rows[0].answer, null);
assert.equal(askRecord(askArgs, { content: [{ type: "text", text: "Error: reserved" }] }).outcome, "unknown", "a result without the record (an error) is not guessed at");
assert.equal(askRecord(askArgs, { details: { outcome: "answers", answers: [] } }).rows[0].answer.answered, false, "a question missing from the record reads as unanswered");

console.log("PASS tool-body logic: diff parsing, argument/kind routing, headers, read notice split, nested summary");
