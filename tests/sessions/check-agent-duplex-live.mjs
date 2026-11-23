import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { launchLiveProcess } from "./agent-duplex/launch-live-process.mjs";
import { boundLiveOperation as bounded } from "./agent-duplex/bound-live-operation.mjs";
import { randomUUID } from "node:crypto";
import { mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePeerMessages } from "../../shared/session-messages/parse-peer-messages.js";
import { checkLiveCancellation } from "./agent-duplex/check-live-cancellation.mjs";

const { values } = parseArgs({ options: {
  help: { type: "boolean" }, model: { type: "string" }, home: { type: "string" },
  cancel: { type: "boolean" }, extension: { type: "string", multiple: true },
}, allowPositionals: false });
if (values.help) {
  console.log("Usage: node tests/sessions/check-agent-duplex-live.mjs --model PROVIDER/MODEL --home COPY [--cancel] [--extension PATH ...]\n"
    + "REAL paid model calls; no controlled provider or model fallback. Default: three agents question each other while busy, print every received peer entry, and assert accepted IDs delivered exactly once, reply routing and completed operations. --cancel: a real agent holds a Python call while another fills its peer backlog; cancel, explicitly start the next run, and inspect the authoritative transcript for a discard notice. The interrupted operation may settle cancelled or unknown under target-side side-effect accounting; neither means effects were rolled back.\n"
    + "Required --home is an existing caller-prepared COPY containing agent/auth.json, models/settings/provider resources as needed. No credentials are copied by this script; never pass the real PRK/Pi home. instances.toml is replaced with an owned Jupyter fixture and config.toml selects direct worker tools, preserving other global settings; the COPY is left modified. PI_CODING_AGENT_DIR is overridden before SDK imports. Unset JUPYTER_URL and JUPYTER_TOKEN; requires the project Python or PI_TEST_PYTHON and same-host filesystem. All model operations are bounded, never retried. Model compliance and paid behavior are not guaranteed by deterministic tests; failures remain failures.");
  process.exit(0);
}
if (!values.model?.includes("/")) throw new Error("Specify --model PROVIDER/MODEL; no model default is permitted.");
if (!values.home) throw new Error("Specify --home with a caller-prepared isolated COPY; no real-home fallback is permitted.");
const home = resolve(values.home);
if (!(await stat(home)).isDirectory()) throw new Error("--home must be an existing isolated credential directory.");
if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) {
  throw new Error("This check requires the owned Jupyter fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
}
initializePrkHome(home);
// Do not move SDK-dependent imports above the explicit home bootstrap.
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { readPrkConfigDocument } = await import("../../src/config/document/read-prk-config-document.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const entry = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "pi-agent-duplex-live-"));
const socket = join(root, "gateway.sock");
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("");
const peers = (state) => state.messages.filter((message) => message.role === "user")
  .flatMap((message) => parsePeerMessages(text(message)) ?? []);
const receipts = (state) => state.messages
  .filter((message) => message.role === "toolResult" && message.toolName === "session_send" && !message.isError)
  .map((message) => JSON.parse(text(message)));
async function exists(path) {
  try { await stat(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
const launch = (args, env) => launchLiveProcess(entry, root, args, env);

try {
  await withTargetFixture(async ({ config, signal, onCleanup }) => {
    let gateway, client;
    let cleanup;
    const close = () => cleanup ??= (async () => { client?.disconnect(); await gateway?.stop(); })();
    onCleanup(close);
    try {
      const configPath = join(home, "config.toml");
      const document = await readPrkConfigDocument(configPath) ?? {};
      const staging = join(home, `.duplex-instances-${randomUUID()}.toml`);
      try {
        await writeFile(staging, stringify({ instances: [{
          ...config, id: "duplex-fixture", label: "Duplex fixture", cwd: root,
        }] }), { mode: 0o600, flag: "wx" });
        await rename(staging, join(home, "instances.toml"));
      } finally { await rm(staging, { force: true }); }
      await writeFile(configPath, stringify({ ...document, session: { ...document.session, workerTools: "direct" } }));
      const env = { ...process.env, PRK_HOME: home, PYTHONDONTWRITEBYTECODE: "1" };
      const args = ["gateway", "--home", home, "--socket", socket, "--no-skills", "--model", values.model];
      for (const path of values.extension ?? []) args.push("--extension", resolve(path));
      gateway = launch(args, env);
      async function until(predicate, description, ms = 180_000) {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {
          signal.throwIfAborted();
          assert.equal(gateway.child.exitCode, null, "gateway exited (provider diagnostics suppressed)");
          assert.equal(gateway.child.signalCode, null, "gateway was terminated");
          if (await predicate()) return;
          await sleep(100);
        }
        throw new Error(`Timed out: ${description}; nothing was replayed.`);
      }
      await until(async () => {
        if (!(await exists(socket))) return false;
        client = await connectGateway(socket);
        return true;
      }, "gateway readiness", 30_000);
      const state = (person) => client.request("state", { sessionId: person.sessionId });
      async function create(label) {
        const run = launch(["attach", "--home", home, "--socket", socket, "create", "--target", "duplex-fixture", "--kernel-name", "python3", "--label", label], env);
        try {
          assert.equal(await bounded(run.done, "create worker"), 0);
          const session = JSON.parse(run.stdout).session; return { label, sessionId: session.sessionId };
        } finally { await run.stop(); }
      }
      async function send(person, message) {
        const result = await client.request("send", { sessionId: person.sessionId, requestId: randomUUID(), message });
        assert.equal(result.accepted, true, `${person.label}: submission accepted`);
        assert(result.operationId, "submission has a real operation ID");
        return result;
      }
      async function terminal(person, submission, statuses = ["completed"]) {
        let outcome;
        await until(async () => {
          outcome = (await state(person)).recentOperations.find((operation) => operation.operationId === submission.operationId);
          return !!outcome;
        }, `${person.label}: operation terminal`);
        assert(statuses.includes(outcome.status), `${person.label}: operation ${submission.operationId} settled ${outcome.status}; expected ${statuses.join(" or ")}`);
        return outcome;
      }
      function print(person) {
        console.log(`\n================ ${person.label} (${person.sessionId}) ================`);
        for (const message of person.state.messages) {
          const entries = message.role === "user" ? parsePeerMessages(text(message)) ?? [] : [];
          for (const peer of entries) console.log(`PEER sender=${peer.sender} message=${peer.messageId} replyTo=${peer.replyTo || "-"} expectReply=${peer.expectReply} batch=${peer.batch ? JSON.stringify(peer.batch) : "single"}\n${peer.body}`);
          if (message.customType === "gateway-peer-discard-notice") console.log(`DISCARD NOTICE:\n${text(message)}`);
          else if (message.role === "assistant") console.log(`ASSISTANT: ${text(message).slice(0, 500) || "(tool call)"}`);
          else if (message.role === "toolResult" && message.toolName === "session_send") console.log(`session_send ${message.isError ? "ERROR" : "receipt"}: ${text(message)}`);
        }
      }

      if (values.cancel) {
        await checkLiveCancellation({ create, root, send, until, exists, state, receipts, peers, client, terminal, print, text });
        return;
      }

      const people = [];
      const specs = [
        { label: "Alice", seconds: 14, asks: ["What is the chemical symbol for gold?", "How many days in a leap year?"] },
        { label: "Bob", seconds: 18, asks: ["What is 17 times 3?", "Name the capital of France."] },
        { label: "Carol", seconds: 22, asks: ["What is 12 plus 30?", "What colour mixes blue and yellow?"] },
      ];
      for (const spec of specs) people.push({ ...spec, ...await create(spec.label) });
      const release = join(root, "all-busy-release");
      for (const person of people) {
        person.marker = join(root, `${person.label}-busy`);
        const others = people.filter((other) => other !== person);
        person.submission = await send(person, [
          `You are ${person.label}. Your peers are ${others.map((other) => `${other.label} (id ${other.sessionId})`).join(" and ")}. Use only these IDs.`,
          `Step 1: call kernel_code once with:\nimport time\nfrom pathlib import Path\nPath(${JSON.stringify(person.marker)}).write_text('busy')\ndeadline=time.monotonic()+90\nwhile not Path(${JSON.stringify(release)}).exists() and time.monotonic()<deadline:\n    time.sleep(0.1)\nassert Path(${JSON.stringify(release)}).exists(), 'coordinator barrier timeout'`,
          `Step 2: send ONE question to each peer with session_send, expectReply true and no replyTo: ask ${others[0].label} '${person.asks[0]}' and ${others[1].label} '${person.asks[1]}'.`,
          `Step 3: call kernel_code with: import time; time.sleep(${person.seconds}); print('slept').`,
          "Step 4: answer each received peer question that expects a reply exactly once using session_send to its sender with replyTo equal to its message ID and expectReply false. Handle every entry in merged batches. Never answer messages marked no reply expected. If questions arrive before Step 2 or Step 3, answer them and still complete those steps.",
          "Finish with one sentence listing the answers received; send nothing else. Never retry a failed tool call.",
        ].join("\n"));
      }
      await until(async () => (await Promise.all(people.map((person) => exists(person.marker)))).every(Boolean), "all three agents entered real Python barrier", 90_000);
      for (const person of people) assert((await state(person)).operation, `${person.label} busy at barrier release`);
      await writeFile(release, "release");
      let signature = "", stableSince = Date.now();
      await until(async () => {
        const states = await Promise.all(people.map(state));
        const nextSignature = states.map((snapshot) => `${snapshot.sequence}:${snapshot.messages.length}:${snapshot.recentOperations.length}:${snapshot.operation?.operationId ?? "idle"}`).join("|");
        if (nextSignature !== signature || states.some((snapshot) => snapshot.operation)) { signature = nextSignature; stableSince = Date.now(); }
        if (Date.now() - stableSince < 8_000) return false;
        people.forEach((person, index) => { person.state = states[index]; });
        return true;
      }, "three sessions settle after questions and replies", 300_000);
      for (const person of people) print(person);
      const accepted = people.flatMap((person) => receipts(person.state).map((receipt) => ({ ...receipt, from: person.sessionId })));
      assert.equal(accepted.length, 12, "scenario requires exactly six real questions and six real replies, not vacuous no-send success");
      assert.equal(new Set(accepted.map((receipt) => receipt.id)).size, accepted.length, "accepted IDs are unique");
      for (const person of people) {
        assert.equal(person.state.messages.filter((message) => message.role === "toolResult" && message.toolName === "session_send" && message.isError).length, 0, `${person.label}: no failed or duplicate send attempts`);
        assert(person.state.recentOperations.some((operation) => operation.operationId === person.submission.operationId), "original submission outcome retained");
        assert(person.state.recentOperations.every((operation) => operation.status === "completed"), `${person.label}: every operation completed`);
        const sent = accepted.filter((receipt) => receipt.from === person.sessionId);
        const questions = sent.filter((receipt) => receipt.expectReply);
        assert.equal(questions.length, 2, `${person.label}: exactly two real questions`);
        assert.deepEqual(questions.map((receipt) => receipt.to).sort(), people.filter((other) => other !== person).map((other) => other.sessionId).sort(), "each peer asked once");
        for (const receipt of questions) assert.equal(receipt.delivery, "queued", "mutual questioning reached a busy recipient");
      }
      for (const receipt of accepted) {
        assert.equal(receipt.accepted, true);
        assert.match(receipt.id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, "accepted peer ID is a UUID");
        assert(Number.isSafeInteger(receipt.pending) && receipt.pending >= 0, "receipt exposes the recipient's real pending count");
        const recipient = people.find((person) => person.sessionId === receipt.to);
        assert(recipient, "receipt addresses a test-owned peer");
        const delivered = peers(recipient.state).filter((peer) => peer.messageId === receipt.id);
        assert.equal(delivered.length, 1, `accepted ${receipt.id} delivered exactly once`);
        assert.equal(delivered[0].sender, receipt.from, "authoritative envelope preserves sender");
        assert.equal(delivered[0].expectReply, receipt.expectReply, "authoritative envelope preserves reply expectation");
        if (receipt.expectReply) {
          const answers = people.flatMap((person) => peers(person.state).map((peer) => ({ ...peer, to: person.sessionId })))
            .filter((peer) => peer.replyTo === receipt.id);
          assert.equal(answers.length, 1, "each real question answered exactly once");
          assert.equal(answers[0].sender, receipt.to, "answer originates at question recipient");
          assert.equal(answers[0].to, receipt.from, "reply routes back to question sender");
        }
      }
      const delivered = people.flatMap((person) => peers(person.state));
      assert.equal(delivered.length, accepted.length, "no unaccounted peer entries in authoritative transcripts");
      const summary = people.map((person) => ({ session: person.label, received: peers(person.state).length,
        batchSizes: [...new Map(peers(person.state).filter((peer) => peer.batch).map((peer) => [peer.batch.id, peer.batch.count])).values()],
        operations: person.state.recentOperations.map((operation) => operation.status) }));
      console.log("SUMMARY " + JSON.stringify({ accepted: accepted.length, delivered: delivered.length, perSession: summary }, null, 2));
      console.log("PASS: REAL three-agent busy mutual questioning; every accepted ID delivered exactly once, every question replied to once with correct routing, every operation completed. Inspect printed bodies for answer quality; semantic correctness is not claimed.");
    } finally { await close(); }
  });
} finally { await rm(root, { recursive: true, force: true }); }
