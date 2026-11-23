// Native `ask` in workers, through a real Pi SDK worker on a test Gateway with an owned Jupyter fixture: a faux model
// either declares the tool (direct mode) or calls it from a kernel cell (code mode, the default), the answers arrive
// the way the web sends them (nativeAction extension-ui / dialog). Stopping the turn must end a waiting cell and leave
// the kernel usable; `session.askTimeoutMs` answers for the user in the cell as it does for a declared tool.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools, getCurrentSystemPrompt } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { readCallableNames } from "../fixtures/gateway-prompt/read-callable-names.mjs";

const text = (message) => typeof message?.content === "string"
  ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(read, check, label, timeoutMs = 20_000) {
  const started = Date.now();
  for (;;) {
    const value = read();
    if (check(value)) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await sleep(20);
  }
}

const QUESTIONS = [
  { id: "storage", header: "Storage", question: "Which database?", options: [{ label: "SQLite" }, { label: "Postgres" }], recommended: 1 },
];
const ASK_CELL = `answer = gateway.ask(questions=${JSON.stringify(QUESTIONS)})\nprint("CELL_GOT<<" + answer + ">>")`;

const stacks = [];
await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-ask-worker-"));
  onCleanup(async () => {
    for (const { host, gateway, client } of stacks) {
      try { client.disconnect(); } catch { /* already closed */ }
      try { await gateway.close(); } catch { /* already closed */ }
      try { await host.close(); } catch { /* already closed */ }
    }
    await rm(root, { recursive: true, force: true });
  });
  const workerCwd = join(root, "worker-cwd");
  await mkdir(workerCwd);
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "ask-worker", models: [{ id: "primary" }], tokensPerSecond: 10_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const contexts = [];
  provider.setResponses(Array.from({ length: 200 }, () => async (context) => {
    contexts.push(context);
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("TURN_DONE");
    const ask = /^ASK (\{.*\})$/s.exec(text(last));
    if (ask) return fauxAssistantMessage(fauxToolCall("ask", JSON.parse(ask[1])), { stopReason: "toolUse" });
    const cell = /^CELL (\{.*\})$/s.exec(text(last));
    if (cell) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: JSON.parse(cell[1]).code, title: "ask cell" }), { stopReason: "toolUse" });
    return fauxAssistantMessage("PLAIN_REPLY");
  }));

  async function start(session = {}, kernel = {}) {
    const dir = await mkdtemp(join(root, "gw-"));
    const host = await createGatewayHost({
      cwd: dir, home: dir, config: parsePrkConfig({ monitor: { enabled: false }, session }), historyDir: join(dir, "history"),
      model: "ask-worker/primary", targets: [{ id: "local", label: "Local", kernel: { ...config, cwd: workerCwd, ...kernel } }],
    }, { runtimeDependencies: { model: provider.getModel("primary"), modelRuntime, thinkingLevel: "off", cwd: dir, agentDir: dir } });
    const socket = join(dir, "gateway.sock");
    const gateway = await startGateway(host, socket);
    const client = await connectGateway(socket);
    const worker = (await host.createSession({ target: "local", cwd: workerCwd })).session.sessionId;
    stacks.push({ host, gateway, client });
    // What the web's workbench subscription sees: the row's `asking` and the `session_ask` frames (their `asking`, in order).
    const asks = [];
    client.onCollectionEvent((event) => { if (event.type === "session_ask" && event.sessionId === worker) asks.push(event.details.asking); });
    await client.request("subscribeSessions", {});
    const row = () => host.workbench().sessions.find((entry) => entry.sessionId === worker);
    const sawAsks = async (expected) => assert.deepEqual(await until(() => asks.slice(), (list) => list.length >= expected.length, `session_ask frames ${expected}`), expected);
    let counter = 0;
    const act = (args) => client.request("nativeAction", { sessionId: worker, requestId: `ask-${++counter}`, action: "extension-ui", args: { ...args, clientId: "test" } });
    const prompts = () => host.state(worker).extensionUi.prompts.filter((prompt) => prompt.kind === "ask");
    const submit = async (message) => {
      const operation = await host.session(worker).submit({ requestId: `turn-${++counter}`, message });
      assert.equal(operation.accepted, true);
      return operation;
    };
    /** Start a turn that reaches the dialog; returns the open prompt. */
    async function asking(message) {
      const operation = await submit(message);
      const [prompt] = await until(prompts, (list) => list.length === 1, "ask prompt");
      return { operation, prompt, answer: (args) => act({ operation: "dialog", id: prompt.id, ...args }) };
    }
    const toolResult = (name) => host.session(worker).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === name);
    const idleKernel = () => until(() => host.state(worker).kernel?.state, (state) => state === "idle", "kernel idle");
    return { host, sessionId: worker, act, prompts, submit, asking, toolResult, idleKernel, row, sawAsks };
  }

  // Declared tool (direct mode): the model is offered `ask`, the dialog sits in the worker's own session.
  {
    const s = await start({ workerTools: "direct" });
    const turn = await s.asking(`ASK ${JSON.stringify({ questions: QUESTIONS })}`);
    assert.equal(s.row().asking, true, "the workbench row says an ask waits");
    await s.sawAsks([true]);
    assert.deepEqual(turn.prompt.questions.map((question) => question.id), ["storage"]);
    assert.equal((await turn.answer({ answers: [{ id: "storage", selected: [0] }] })).status, "completed");
    assert.equal((await turn.operation.completion).status, "completed");
    assert.equal(s.row().asking, undefined, "answered: the row no longer says so");
    await s.sawAsks([true, false]);
    assert.equal(text(s.toolResult("ask")), "User answers:\nstorage: SQLite");
    assert.deepEqual(s.toolResult("ask").details.answers.map((answer) => answer.selected), [["SQLite"]]);
    assert(getCurrentTools(contexts.at(-1).messages).some((tool) => tool.name === "ask"), "direct-mode worker is offered ask");
    // The runtime going away with the dialog open clears the mark too.
    const second = await s.asking(`ASK ${JSON.stringify({ questions: QUESTIONS })}`);
    assert.equal(s.row().asking, true);
    await s.sawAsks([true, false, true]);
    await s.host.closeSession(s.sessionId);
    assert.equal(s.row().asking, undefined, "closed: no ask waits");
    await s.sawAsks([true, false, true, false]);
    await second.operation.completion;
  }

  // Code mode: the model is offered only kernel_code; ask is a callable the cell uses, and the cell waits for the user.
  const code = await start();
  {
    const first = await code.submit("hello");
    await first.completion;
    const names = getCurrentTools(contexts.at(-1).messages).map((tool) => tool.name);
    assert(names.includes("kernel_code") && !names.includes("ask") && readCallableNames(getCurrentSystemPrompt(contexts.at(-1).messages)).includes("ask"), "Code mode hides the ask declaration while advertising its callable entry to the provider");

    const turn = await code.asking(`CELL ${JSON.stringify({ code: ASK_CELL })}`);
    assert.equal(code.row().asking, true, "a waiting cell is an ask too");
    await code.sawAsks([true]);
    assert.deepEqual(turn.prompt.questions.map((question) => question.id), ["storage"]);
    assert.equal((await turn.answer({ answers: [{ id: "storage", selected: [0] }] })).status, "completed");
    assert.equal((await turn.operation.completion).status, "completed");
    assert.equal(code.row().asking, undefined);
    await code.sawAsks([true, false]);
    const result = code.toolResult("kernel_code");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /CELL_GOT<<User answers:\nstorage: SQLite>>/);
    assert.equal(text(contexts.at(-1).messages.at(-1)), text(result), "the model sees what the cell printed");
  }

  // Stopping the turn while the cell waits: the dialog closes, the cell ends, the model is not called again, and the
  // kernel (with its variables) still runs the next cell.
  {
    await (await code.submit(`CELL ${JSON.stringify({ code: "retained = 41" })}`)).completion;
    const turn = await code.asking(`CELL ${JSON.stringify({ code: `retained += 1\n${ASK_CELL}\nretained = -1` })}`);
    assert.equal(code.row().asking, true);
    await code.sawAsks([true, false, true]);
    const calls = contexts.length;
    await code.host.session(code.sessionId).cancel({ operationId: turn.operation.operationId });
    await turn.operation.completion;
    await until(code.prompts, (list) => list.length === 0, "dialog closed by turn stop");
    assert.equal(code.row().asking, undefined, "stopped: the mark clears with the dialog");
    await code.sawAsks([true, false, true, false]);
    await until(() => code.host.state(code.sessionId).state, (state) => state === "idle", "worker idle after stop");
    await code.idleKernel();
    await sleep(200);
    assert.equal(contexts.length, calls, "the stopped turn does not call the model again");
    assert.equal((await turn.answer({ chat: true })).status, "unavailable", "the closed dialog accepts no answer");
    const next = await code.submit(`CELL ${JSON.stringify({ code: "assert retained == 42, retained\nprint('KERNEL_STILL_USABLE')" })}`);
    assert.equal((await next.completion).status, "completed");
    const result = code.toolResult("kernel_code");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /KERNEL_STILL_USABLE/);
  }

  // `session.askTimeoutMs`: the cell gets the recommended answer, marked as automatic.
  {
    const quick = await start({ askTimeoutMs: 400 });
    const turn = await quick.asking(`CELL ${JSON.stringify({ code: ASK_CELL })}`);
    assert.equal(quick.row().asking, true);
    assert.ok(turn.prompt.expiresAt > Date.now() - 1000 && turn.prompt.expiresAt <= Date.now() + 400, "expiresAt is the deadline");
    assert.equal((await turn.operation.completion).status, "completed");
    assert.equal(quick.row().asking, undefined, "timed out: the mark clears");
    await quick.sawAsks([true, false]);
    const result = quick.toolResult("kernel_code");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /CELL_GOT<<User answers:\nstorage: Postgres \(auto-selected after timeout\)>>/);
    assert.equal(quick.prompts().length, 0);
  }

  // The cell's deadline (the target's `executionTimeoutMs`) does not run while the cell waits for the user; the work
  // around the wait still counts, from where it paused.
  {
    const short = await start({}, { executionTimeoutMs: 1500 });
    // The marker is assembled at run time: an interrupted cell's traceback quotes its source lines.
    const cell = (before, after) => `CELL ${JSON.stringify({ code: `import time\ntime.sleep(${before})\n${ASK_CELL}\ntime.sleep(${after})\nprint("AFTER_" + "DONE")` })}`;
    const answer = { answers: [{ id: "storage", selected: [0] }] };

    // Waiting well past the deadline does not end the cell; after the answer it finishes normally.
    let turn = await short.asking(cell(0.2, 0.2));
    await sleep(2500);
    assert.equal(short.prompts().length, 1, "the dialog outlives the cell deadline");
    assert.equal((await turn.answer(answer)).status, "completed");
    assert.equal((await turn.operation.completion).status, "completed");
    let result = short.toolResult("kernel_code");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /CELL_GOT<<User answers:\nstorage: SQLite>>[\s\S]*AFTER_DONE/);

    // The time used around the wait is kept, not restarted: 1.0 s before + 1.0 s after exceeds 1.5 s however long the wait was.
    turn = await short.asking(cell(1.0, 1.0));
    await sleep(2500);
    assert.equal(short.prompts().length, 1);
    assert.equal((await turn.answer(answer)).status, "completed");
    await turn.operation.completion;
    result = short.toolResult("kernel_code");
    assert.equal(result.isError, true, "the work after the answer is still bound by the deadline");
    assert.match(text(result), /timed out after 1500ms/);
    assert(!text(result).includes("AFTER_DONE"));
    await short.idleKernel();

    // Stopping the turn after the original deadline would have passed still ends the cell at once and leaves the kernel usable.
    turn = await short.asking(cell(0.1, 0.1));
    await sleep(2000);
    const stoppedAt = Date.now();
    await short.host.session(short.sessionId).cancel({ operationId: turn.operation.operationId });
    await turn.operation.completion;
    assert.ok(Date.now() - stoppedAt < 5000, "the stop is not held up by the paused deadline");
    await until(short.prompts, (list) => list.length === 0, "dialog closed by turn stop");
    await until(() => short.host.state(short.sessionId).state, (state) => state === "idle", "worker idle after stop");
    await short.idleKernel();
    assert.equal((await (await short.submit(`CELL ${JSON.stringify({ code: "print('STILL_USABLE')" })}`)).completion).status, "completed");
    assert.match(text(short.toolResult("kernel_code")), /STILL_USABLE/);
  }
  console.log("PASS check-ask-worker");
}, { pythonExecutable: process.env.PI_TEST_PYTHON });
