import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
// Owned Jupyter + real SDK terminal dispatch; faux provider only, no browser or paid model.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createTerminalModelRequests } from "./terminal-dispatch/create-model-requests.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Unset JUPYTER_URL and JUPYTER_TOKEN; this check owns its fixture.");
const root = await mkdtemp(join(tmpdir(), "prk-ll-"));
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const line = (`HEADabcd${"x".repeat(70_000)}LEFTfooRIGHT${"x".repeat(70_000)}BEFRbarAFTR${"x".repeat(70_000)}LASTfooNEXT`).padEnd(300 * 1024 - 8, "x") + "wxyzTAIL";
const command = "grep -n -E 'foo|bar' long.txt";
const expected = "1:HEADabcdxx … LEFTfooRIGH … BEFRbarAFTR … LASTfooNEXT … wxyzTAIL\n";

try {
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const { agentDir } = initializePrkHome(root);
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false } }));
    const cwd = join(tempRoot, "target");
    await mkdir(cwd);
    await writeFile(join(cwd, "long.txt"), line + "\n");
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxProvider, fauxAssistantMessage, getCurrentTools } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
    const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "long-line-check", models: [{ id: "controlled" }], tokensPerSecond: 100_000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const consumed = new Map();
    const declarations = [];
    const terminalRequests = createTerminalModelRequests();
    provider.setResponses(Array.from({ length: 40 }, () => (context) => {
      declarations.push(getCurrentTools(context.messages));
      const last = context.messages.at(-1);
      const continuation = terminalRequests.resume(context);
      if (continuation) return continuation;
      if (last?.role === "toolResult") {
        consumed.set(last.toolCallId, last);
        return fauxAssistantMessage("Observed terminal result.");
      }
      const request = /^LONGLINE_FIXTURE (\{.*\})$/s.exec(text(last));
      assert(request, "only controlled user requests reach this fixture");
      const { id, tool, args } = JSON.parse(request[1]);
      return terminalRequests.issue(context, { id, tool, args });
    }));
    let gateway, client;
    onCleanup(async () => { client?.disconnect(); await gateway?.close(); });
    const host = await createGatewayHost({
      cwd: root, home: root, model: "long-line-check/controlled",
      config: parsePrkConfig({
        session: { workerTools: "direct", idleTimeoutMs: 60_000, capabilities: { "lazy:group:tools:package:<inline:terminals>": true } }, memory: { review: false },
        terminal: { longLineThresholdChars: 1000, longLineHeadChars: 12, longLineTailChars: 8, longLineContextChars: 4 },
      }),
      targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "Owned long-line fixture", local: true, tags: [], cwd })],
    }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off" } });
    const socket = join(root, "gateway.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const runtime = host.session(worker);
    let sequence = 0;
    async function run(tool, args) {
      const id = `long-line-${++sequence}`;
      const operation = await runtime.submit({ requestId: id, message: `LONGLINE_FIXTURE ${JSON.stringify({ id, tool, args })}` });
      assert.equal(operation.accepted, true, operation.error);
      let timer;
      try {
        const completed = await Promise.race([operation.completion, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${tool} timed out`)), 30_000); })]);
        assert.equal(completed.status, "completed");
      } finally { clearTimeout(timer); }
      const result = consumed.get(id);
      assert(result, "faux provider must consume the actual SDK tool result");
      assert.equal(result.isError, false, text(result));
      return result;
    }
    const call = async (tool, args) => JSON.parse(text(await run(tool, args)));
    const searched = await call("terminal_textsend", { text: command, yield_s: 10 });
    assert.equal(searched.status, "done");
    assert.equal(searched.exit_code, 0);
    const tools = declarations[0];
    assert(!tools.some(({ name }) => name === "terminal_textsend"), "The lazy terminal is not directly declared");
    const sendSchema = terminalRequests.schemas.get("terminal_textsend").parameters;
    assert(sendSchema.required.includes("text"));
    assert(!Object.hasOwn(sendSchema.properties, "command"));
    const hints = [...searched.output.matchAll(/…\[\+(\d+) chars, terminal_read\(command="([^"]+)", offset=(\d+)\)\]…/gu)];
    assert.equal(hints.length, 4);
    assert.equal(searched.output.replace(/ …\[\+\d+ chars, terminal_read\(command="[^"]+", offset=\d+\)\]… /gu, " … "), expected);
    const hint = hints[1];
    assert.equal(hint[2], searched.command_id);
    const gapStart = `1:${line}\n`.indexOf("LEFTfooRIGH") + "LEFTfooRIGH".length;
    assert.equal(Number(hint[3]), Buffer.byteLength(`1:${line}\n`.slice(0, gapStart)));
    const gapPage = await call("terminal_read", { command: hint[2], offset: Number(hint[3]) });
    assert.equal(gapPage.output, `1:${line}\n`.slice(gapStart, gapStart + 50_000));
    assert.equal(searched.truncated, true);
    assert.equal(searched.total_bytes, Buffer.byteLength(`1:${line}\n`));
    const cat = await call("terminal_textsend", { text: "cat long.txt", yield_s: 10 });
    assert.equal(cat.output.replace(/ …\[\+\d+ chars, terminal_read\(command="[^"]+", offset=\d+\)\]… /gu, " … "), "HEADabcdxxxx … wxyzTAIL\n");
    assert.equal(cat.truncated, true);
    assert.equal(cat.total_bytes, 300 * 1024 + 1);
    let full = "";
    for (let offset = 0; offset < searched.total_bytes;) {
      const page = await call("terminal_read", { command: searched.command_id, offset });
      const bytes = Buffer.byteLength(page.output);
      assert(bytes > 0 && bytes <= 50_000, "original pages make bounded byte progress");
      full += page.output;
      offset += bytes;
      assert.equal(page.truncated, offset < searched.total_bytes);
    }
    assert.equal(full, `1:${line}\n`, "paging retains every original byte after shortening and a later command");
    assert.equal((await client.request("nativeAction", { sessionId: worker, requestId: "long-line-code", action: "tool-mode", args: { mode: "code" } })).status, "completed");
    const contract = JSON.parse(text(await run("kernel_code", { code: "import json\nprint(json.dumps(bash(\"printf out; printf err >&2\")))" })).split("\n")[0]);
    assert.deepEqual(Object.keys(contract).sort(), ["duration_ms", "exit_code", "stderr", "stdout", "timed_out", "truncated"]);
    assert.equal(contract.stdout, "out");
    assert.equal(contract.stderr, "err");
    for (const key of ["exit_code", "duration_ms", "truncated"]) assert.equal(typeof contract[key], typeof searched[key], key);
    assert.equal(contract.truncated, false, "raw bash streams are not trimmed");
    for (const key of ["exitCode", "durationMs", "full_output_path"]) assert(!(key in contract) && !(key in searched), key);
    const code = await run("kernel_code", { code: `import re\nr = gateway.terminal_textsend(text=${JSON.stringify(command)}, yield_s=10)\nassert re.sub(r' …\\[\\+\\d+ chars, terminal_read\\(command="[^"]+", offset=\\d+\\)\\]… ', ' … ', r["output"]) == ${JSON.stringify(expected)}, repr(r["output"])\nassert r["truncated"] is True\nraw = bash("cat long.txt")\nassert raw["exit_code"] == 0\nassert raw["stdout"] == open("long.txt").read()\nassert len(raw["stdout"]) == 307201\nprint("LONG_LINE_CODE_AND_RAW_BASH_OK")`, title: "Verify code terminal trimming and unchanged raw bash data" });
    assert.match(text(code), /LONG_LINE_CODE_AND_RAW_BASH_OK/);
    console.log(JSON.stringify({ fixture: "real SDK/Jupyter terminal", originalBytes: searched.total_bytes, compactBytes: Buffer.byteLength(searched.output), searchWindows: 3, originalPaging: "exact", codeTerminal: "PASS", rawPythonBash: "PASS", paidCalls: 0 }));
  }, { allowHidden: true });
} finally { await rm(root, { recursive: true, force: true }); }
