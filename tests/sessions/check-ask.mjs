import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
// Native `ask` through a real Pi SDK worker on a test Gateway: a faux model issues the tool call, the
// answers arrive the way the web sends them (nativeAction extension-ui / dialog), and the tool result the model sees
// is read back from the next provider context.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { checkTimeout } from "./ask/check-timeout.mjs";
import { waitForAskState } from "../fixtures/ask/wait-for-ask-state.mjs";

const text = (message) => typeof message?.content === "string"
  ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const QUESTIONS = [
  { id: "storage", header: "Storage", question: "Which database?", options: [{ label: "SQLite" }, { label: "Postgres", description: "networked", preview: "```sql\nselect 1;\n```" }], recommended: 1 },
  { id: "features", question: "Which features?", multi: true, options: [{ label: "Search" }, { label: "Export" }, { label: "Sync" }] },
];

const root = await mkdtemp(join(tmpdir(), "pi-ask-"));
const hosts = [];
await withTargetFixture(async ({ config }) => {
try {
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "ask-check", models: [{ id: "primary" }], tokensPerSecond: 10_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const contexts = [];
  provider.setResponses(Array.from({ length: 200 }, () => async (context) => {
    contexts.push(context);
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("ASK_TURN_DONE");
    const command = /^ASK (\{.*\})$/s.exec(text(last));
    if (command) return fauxAssistantMessage(fauxToolCall("ask", JSON.parse(command[1])), { stopReason: "toolUse" });
    return fauxAssistantMessage("PLAIN_REPLY");
  }));

  async function start(session = {}) {
    const dir = await mkdtemp(join(root, "gw-"));
    const host = await createGatewayHost({
      cwd: dir, home: dir, config: parsePrkConfig({ session: { workerTools: "direct", capabilities: { "lazy:tool:ask": false }, ...session } }), historyDir: join(dir, "history"),
      model: "ask-check/primary", targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "fixture", cwd: root })],
    }, { runtimeDependencies: { model: provider.getModel("primary"), modelRuntime, thinkingLevel: "off", cwd: dir, agentDir: dir } });
    const socket = join(dir, "gateway.sock");
    const gateway = await startGateway(host, socket);
    const client = await connectGateway(socket);
    hosts.push({ host, gateway, client });
    await prepareGatewayEnvironment(host, dir, "fixture");
    const main = (await client.request("createSession", { target: "fixture", label: "ask coordinator" })).session.sessionId;
    // What the web's workbench subscription sees: the row's `asking` and the `session_ask` frames (their `asking`, in order).
    const asks = [];
    client.onCollectionEvent((event) => { if (event.type === "session_ask" && event.sessionId === main) asks.push(event.details.asking); });
    await client.request("subscribeSessions", {});
    const row = () => host.workbench().sessions.find((entry) => entry.sessionId === main);
    const sawAsks = async (expected, since = 0) => assert.deepEqual((await waitForAskState(() => asks.slice(since), (list) => list.length >= expected.length, `session_ask frames ${expected}`)).slice(0, expected.length), expected);
    let counter = 0;
    const act = (args) => client.request("nativeAction", { sessionId: main, requestId: `ask-${++counter}`, action: "extension-ui", args: { ...args, clientId: "test" } });
    const prompts = () => host.state(main).extensionUi.prompts.filter((prompt) => prompt.kind === "ask");
    /** Start a turn whose model asks `questions`; returns the open prompt and a way to finish the turn. */
    async function asking(questions) {
      const operation = await host.session(main).submit({ requestId: `ask-turn-${++counter}`, message: `ASK ${JSON.stringify({ questions })}` });
      assert.equal(operation.accepted, true);
      const [prompt] = await waitForAskState(prompts, (list) => list.length === 1, "ask prompt");
      return { operation, prompt, answer: (args) => act({ operation: "dialog", id: prompt.id, ...args }) };
    }
    /** The tool result of the turn that just completed, and the content the model saw next. */
    async function finished(operation) {
      const outcome = await operation.completion;
      const seen = contexts.at(-1).messages.at(-1);
      const result = host.session(main).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === "ask");
      return { outcome, seen, result };
    }
    return { host, client, main, act, prompts, asking, finished, asks, row, sawAsks };
  }

  const s = await start();

  // Main exposes `ask`; the dialog is a normal extension-UI prompt carrying the typed questions.
  {
    const turn = await s.asking(QUESTIONS);
    assert.equal(s.row().asking, true, "the workbench row says an ask waits");
    await s.sawAsks([true]);
    assert.deepEqual(turn.prompt.questions.map((q) => q.id), ["storage", "features"]);
    assert.equal(turn.prompt.questions[0].recommended, 1, "recommended index reaches the web");
    assert.equal(turn.prompt.questions[0].options[1].preview, "```sql\nselect 1;\n```");
    assert.equal(turn.prompt.expiresAt, undefined, "default askTimeoutMs=0 never expires");
    const exposed = new Set(getCurrentTools(contexts.at(-1).messages).map((tool) => tool.name));
    assert(exposed.has("ask"), "main session exposes ask");

    // Invalid answers are rejected at the boundary and leave the dialog open.
    const bad = [
      { answers: [] },
      { answers: [{ id: "storage", selected: [0] }] },
      { answers: [{ id: "features", selected: [0] }, { id: "storage", selected: [0] }] },
      { answers: [{ id: "storage", selected: [5] }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", selected: [0, 1] }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", selected: [0, 0] }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", selected: [0], custom: { text: "x" } }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", selected: [], note: { text: "orphan" } }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", custom: { text: "  " } }, { id: "features", selected: [] }] },
      // Answers carry text only: an attachment, even an empty list, is refused rather than dropped.
      { answers: [{ id: "storage", custom: { text: "x", attachments: [] } }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", custom: { text: "x", attachments: [{ name: "a.png", type: "image/png", size: 1, data: "AA==", source: "browser" }] } }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", selected: [0], note: { text: "n", attachments: [{ name: "a.png", type: "image/png", size: 1, data: "AA==", source: "browser" }] } }, { id: "features", selected: [] }] },
      { answers: [{ id: "storage", custom: { text: "x", extra: 1 } }, { id: "features", selected: [] }] },
      { answers: "storage" },
    ];
    for (const args of bad) {
      const response = await turn.answer(args);
      assert.equal(response.status, "unavailable", JSON.stringify(args).slice(0, 120));
      assert.equal(s.prompts().length, 1, "a rejected answer leaves the dialog open");
    }
    await sleep(100);
    assert.deepEqual(s.asks, [true], "rejected answers leave the mark alone");

    // Single + multi, answered in a different order than ascending, with a note.
    const response = await turn.answer({ answers: [{ id: "storage", selected: [1], note: { text: "use v16" } }, { id: "features", selected: [2, 0] }] });
    assert.equal(response.status, "completed");
    const { outcome, seen, result } = await s.finished(turn.operation);
    assert.equal(outcome.status, "completed");
    assert.equal(s.prompts().length, 0);
    assert.equal(s.row().asking, undefined, "answered: the row no longer says so");
    await s.sawAsks([true, false]);
    assert.equal(text(seen), "User answers:\nstorage: Postgres (note: use v16)\nfeatures: [Search, Sync]");
    assert.deepEqual(result.details, { outcome: "answers", answers: [{ id: "storage", selected: ["Postgres"], note: "use v16" }, { id: "features", selected: ["Search", "Sync"] }] });
    assert.equal(result.isError, false);
  }

  // Other (custom text) replaces a single-select choice; multi can combine both with a note; empty multi is []. The result is text only.
  {
    const turn = await s.asking(QUESTIONS);
    const response = await turn.answer({ answers: [
      { id: "storage", selected: [], custom: { text: "MariaDB" } },
      { id: "features", selected: [1], custom: { text: "Audit log" }, note: { text: "second" } },
    ] });
    assert.equal(response.status, "completed");
    const { seen, result } = await s.finished(turn.operation);
    assert.equal(text(seen), "User answers:\nstorage: \"MariaDB\"\nfeatures: [Export] + \"Audit log\" (note: second)");
    assert.deepEqual(seen.content.map((part) => part.type), ["text"], "no image block follows the answers");
    assert.deepEqual(result.details.answers.map((answer) => [answer.custom, answer.note]), [["MariaDB", undefined], ["Audit log", "second"]]);
    const empty = await s.asking([QUESTIONS[1]]);
    await empty.answer({ answers: [{ id: "features", selected: [] }] });
    assert.equal(text((await s.finished(empty.operation)).seen), "User answers:\nfeatures: []");
  }

  // "Chat about this": no answer, the model is told to discuss first.
  {
    const turn = await s.asking(QUESTIONS);
    assert.equal((await turn.answer({ chat: true })).status, "completed");
    const { seen, result } = await s.finished(turn.operation);
    assert.match(text(seen), /^User chose to chat about this instead of answering\./);
    assert.match(text(seen), /Which database\?\nWhich features\?$/);
    assert.deepEqual(result.details, { outcome: "chat" });
  }

  // `dialog cancel` on the wire (the web's 取消 stops the turn instead, below): the tool reports cancellation and the turn goes on.
  {
    const turn = await s.asking(QUESTIONS);
    assert.equal((await turn.answer({ cancel: true })).status, "cancelled");
    const { outcome, seen, result } = await s.finished(turn.operation);
    assert.equal(outcome.status, "completed");
    assert.equal(text(seen), "User cancelled the questions without answering.");
    assert.deepEqual(result.details, { outcome: "cancelled" });
  }

  // Stopping the turn (what the web's 取消 does, through the ordinary stop) closes the dialog, the tool's result is recorded as
  // cancelled, the model is not called again and the session takes the next message.
  {
    const before = s.asks.length;
    const turn = await s.asking(QUESTIONS);
    assert.equal(s.row().asking, true);
    const calls = contexts.length;
    await s.host.session(s.main).cancel({ operationId: turn.operation.operationId });
    await turn.operation.completion;
    await waitForAskState(s.prompts, (list) => list.length === 0, "dialog closed by turn stop");
    assert.equal(s.row().asking, undefined, "stopped: the mark clears with the dialog");
    await s.sawAsks([true, false], before);
    await waitForAskState(() => s.host.state(s.main).state, (state) => state === "idle", "idle after stop");
    await sleep(200);
    assert.equal(contexts.length, calls, "the stopped turn does not call the model again");
    const stopped = s.host.session(s.main).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === "ask");
    assert.deepEqual(stopped?.details, { outcome: "cancelled" }, "the ask call's result is recorded as cancelled");
    assert.deepEqual((await s.act({ operation: "dialog", id: turn.prompt.id, chat: true })).status, "unavailable", "the closed dialog accepts no answer");
    const next = await s.host.session(s.main).submit({ requestId: "after-stop", message: "hello again" });
    assert.equal(next.accepted, true, "the session takes the next message");
    assert.equal((await next.completion).status, "completed");
  }

  // Tool-level refusals: reserved rows, duplicate ids/labels. No dialog opens; the model sees an error result.
  for (const [questions, reason] of [
    [[{ id: "a", question: "q", options: [{ label: "Other" }, { label: "x" }] }], /reserved/],
    [[{ id: "a", question: "q", options: [{ label: "其他…" }] }], /reserved/],
    [[{ id: "a", question: "q", options: [{ label: "Chat about this" }] }], /reserved/],
    [[{ id: "a", question: "q", options: [{ label: "x" }, { label: "x" }] }], /unique/],
    [[{ id: "a", question: "q", options: [{ label: "x" }] }, { id: "a", question: "r", options: [{ label: "y" }] }], /unique/],
  ]) {
    const operation = await s.host.session(s.main).submit({ requestId: `ask-refused-${Math.random()}`, message: `ASK ${JSON.stringify({ questions })}` });
    await operation.completion;
    assert.equal(s.prompts().length, 0);
    const result = s.host.session(s.main).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === "ask");
    assert.equal(result.isError, true);
    assert.match(text(result), reason);
  }

  await checkTimeout(start, QUESTIONS, text);
  console.log("PASS check-ask");
} finally {
  for (const { host, gateway, client } of hosts) {
    try { client.disconnect(); } catch { /* already closed */ }
    try { await gateway.close(); } catch { /* already closed */ }
    try { await host.close(); } catch { /* already closed */ }
  }
  await rm(root, { recursive: true, force: true });
}
});
