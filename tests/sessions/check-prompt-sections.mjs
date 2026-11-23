// Real SDK/Gateway/Jupyter + approved loopback HTTP stub; original Pi Responses serializer.
// Capture only before_provider_request payloads, never reconstructed SDK context. No paid calls.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { assemblePromptFixture } from "./prompt-sections/assemble-prompt-fixture.mjs";
import { assertRenderedSections } from "./prompt-sections/assert-rendered-sections.mjs";
import { assertSessionSection } from "./prompt-sections/assert-session-section.mjs";
import { assertTerminalUsage } from "./prompt-sections/assert-terminal-usage.mjs";
import { checkCapabilitySections } from "./prompt-sections/check-capability-sections.mjs";
import { writeRenderedRequest } from "./prompt-sections/write-rendered-request.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-prompt-sections-"));
const keys = ["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR", "PRK_PROMPT_CAPTURE_FILE"];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
const { agentDir } = initializePrkHome(home);
try {
  await mkdir(process.env.HOME);
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  await withTargetFixture(async (jupyter) => {
    const fixture = await assemblePromptFixture({ home, agentDir, ...jupyter });
    const { host, run, action, captureFor } = fixture;
    const full = { kernel: true, gateway_calls: true, tool_catalog: true, sessions: true, ask: true, memory: true, skill_tools: true, native_tools: true };
    const root = (await host.createSession({ target: "fixture", label: "Prompt Root" })).session.sessionId;
    host.setSessionRoot({ sessionId: root });
    const top = (await run(root)).request;
    await writeRenderedRequest("top-level", top);
    // This first assertion intentionally fails on the old implementation before using renamed lifecycle values.
    const topSections = assertRenderedSections(top.instructions, full);
    assertSessionSection(topSections.get("sessions"));
    const spawn = async (parent, label) => {
      const batch = (await run(parent, "session_spawn", { context: "Isolated system-prompt verification. Do not call tools or finish the task until explicitly instructed.",
        tasks: [{ task: `Observe the assigned ${label} prompt and await explicit instructions.`, label, lifecycle: "persistent", target: "fixture" }] })).data;
      assert.deepEqual(batch.errors, [], "The real session_spawn tool must admit the child");
      assert.equal(batch.children.length, 1);
      assert.equal(batch.children[0].sessionName, label);
      return host.workbench().sessions.find((entry) => entry.sessionId === batch.children[0].sessionId).sessionId;
    };
    const child = await spawn(root, "Prompt Child");
    const firstChild = await captureFor(child);
    await writeRenderedRequest("depth-1", firstChild);
    assertSessionSection(assertRenderedSections(firstChild.instructions, full).get("sessions"), { depth: 1, parentLabel: "Prompt Root" });
    const nested = await spawn(child, "Prompt Grandchild");
    const secondChild = await captureFor(nested);
    await writeRenderedRequest("depth-2", secondChild);
    assertSessionSection(assertRenderedSections(secondChild.instructions, full).get("sessions"), { depth: 2, parentLabel: "Prompt Child" });
    await host.renameSession(root, "Prompt Root Renamed");
    const renamedRoot = (await run(child)).request;
    assertSessionSection(assertRenderedSections(renamedRoot.instructions, full).get("sessions"), { depth: 1, parentLabel: "Prompt Root Renamed" });
    await host.renameSession(child, "Prompt Child Renamed");
    const renamedChild = (await run(nested)).request;
    assertSessionSection(assertRenderedSections(renamedChild.instructions, full).get("sessions"), { depth: 2, parentLabel: "Prompt Child Renamed" });
    await action(root, "tool-mode", { mode: "direct" });
    for (const name of ["terminal_list", "terminal_textsend", "terminal_keysend", "terminal_read", "terminal_set", "terminal_close"]) await fixture.toggle(root, `lazy:tool:${name}`, false);
    const terminal = await run(root, "kernel_code", { code: [
      "prompt_schema = __import__('json').dumps({name: gateway.describe(name) for name in ['terminal_textsend', 'terminal_keysend', 'terminal_read', 'terminal_set', 'terminal_list', 'terminal_close']})",
      "print('PROMPT_TERMINAL_SCHEMA_LENGTH=' + str(len(prompt_schema)))",
      "for offset in range(0, len(prompt_schema), 160):",
      "    print('PROMPT_TERMINAL_SCHEMA=' + prompt_schema[offset:offset + 160])",
    ].join("\n") });
    const schemaParts = [...terminal.text.matchAll(/PROMPT_TERMINAL_SCHEMA=([^\n]*)/gu)];
    assert(schemaParts.length, "The real Jupyter kernel must return the real gateway.describe terminal schema");
    const schemaLength = /PROMPT_TERMINAL_SCHEMA_LENGTH=(\d+)/u.exec(terminal.text);
    assert(schemaLength, "The real terminal schema output must include its complete serialized length");
    const serializedSchema = schemaParts.map((part) => part[1]).join("");
    assert.equal(serializedSchema.length, Number(schemaLength[1]), "Chunked gateway.describe metadata must reassemble without truncation or loss");
    const schema = JSON.parse(serializedSchema);
    assertTerminalUsage(top, schema, false);
    assertTerminalUsage(firstChild, schema, false);
    assertTerminalUsage(secondChild, schema, false);
    for (const request of terminal.requests) {
      assertRenderedSections(request.instructions, full);
      assertTerminalUsage(request, schema, true);
    }
    await checkCapabilitySections(fixture, root, child);
    console.log(JSON.stringify({ ok: true, provider: "owned HTTP stub + unmodified Pi openai-responses", capture: "public before_provider_request",
      instructionsSource: "payload.input system/developer content", renderedDir: process.env.PRK_PROMPT_RENDERED_DIR ?? null,
      coverage: "root/depth1/depth2, live parent labels, spawn-disabled identities, empty topic omission, terminal description-only usage" }));
  });
} finally {
  for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(home, { recursive: true, force: true });
}
