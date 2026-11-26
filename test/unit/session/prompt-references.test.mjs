import assert from "node:assert/strict";
import { test } from "node:test";
import { STATIC_KERNEL_HELPERS } from "../../../src/codemode/module-catalog/cold-catalog.ts";
import { renderKernel } from "../../../src/plugins/kernel/prompt/kernel/render.ts";
import { renderGatewayCalls } from "../../../src/plugins/kernel/prompt/gateway-calls/render.ts";
import { renderAsk } from "../../../src/plugins/ask/prompt/render.ts";
import { renderSessions } from "../../../src/plugins/sessions/prompt/render.ts";
import { renderSkillTools } from "../../../src/plugins/skill-tools/prompt/render.ts";
import { renderMemory } from "../../../src/plugins/memory/prompt/render.ts";
import { renderSkills } from "../../../src/sessions/runtime/prompt/skills/render.ts";
import { findDanglingReferences } from "../../fixtures/prompt/find-dangling-references.mjs";

// The cold catalog is a snapshot of the real kernel's report: the file module's exports plus the prelude's own helpers.
const helpers = STATIC_KERNEL_HELPERS;
const everyTool = ["kernel_code", "kernel_read", "kernel_interrupt", "terminal_textsend", "ask", "memory", "skill_read", "skill_manage", "tool_search", "tool_call",
  "session_spawn", "session_list", "session_send", "session_result"];
const known = new Set([...everyTool, ...helpers.map(({ name }) => name), "read", "write", "edit", "grep", "glob", "ls", "bash"]);
const skills = [{ name: "visible", description: "A skill.", filePath: "/skills/visible/SKILL.md" }];
const layers = [{ name: "control", explicitOnly: true }, { name: "user" }, { name: "project" }];

function kernelInput(callable) {
  return {
    helpers, toolLibrary: true, autoTools: true, asyncExecution: true, cellTools: callable.includes("kernel_read"), titleRequired: false, language: "python",
    kernelCapabilities: () => true, binaryPrompt: () => undefined,
  };
}

function codeMode(callable) {
  const declared = ["kernel_code", ...callable.filter((name) => name.startsWith("kernel_"))];
  const texts = [
    ["kernel", renderKernel(kernelInput(callable))],
    ["gateway_calls", renderGatewayCalls("python")],
    ["ask", renderAsk(callable)],
    ["sessions", renderSessions(callable.includes("session_result") ? { depth: 1, parentLabel: "p", isolated: false } : undefined, "restrained", callable)],
    ["skill_tools", renderSkillTools({ autoSkills: true, instance: "x" }, callable)],
    ["memory", renderMemory(callable, layers)],
    ["skills", renderSkills(skills, callable.includes("skill_read") ? { mode: "code", declared, language: "python" } : undefined)],
  ];
  return findDanglingReferences(texts, { known, available: new Set([...declared, ...callable, ...helpers.map(({ name }) => name)]) });
}

test("code mode prompts name only the tools and kernel helpers the session offers", () => {
  assert.deepEqual(codeMode(everyTool.filter((name) => name !== "kernel_code")), []);
  assert.deepEqual(codeMode([]), []);
  assert.deepEqual(codeMode(["ask", "memory"]), []);
});

test("every function the kernel stubs define is a helper the kernel really has", () => {
  const stubbed = [...renderKernel(kernelInput(everyTool)).matchAll(/^def (\w+)\(/gm)].map((match) => match[1]);
  const real = new Set(helpers.map(({ name }) => name));
  assert.deepEqual(stubbed.filter((name) => !real.has(name)), []);
  assert.deepEqual([...real].filter((name) => !stubbed.includes(name)), []);
});

test("direct mode delegation policy names no kernel helper the native tools lack", () => {
  const direct = new Set(["session_spawn", "session_list", "session_send", "session_result", "read", "grep", "find", "ls", "edit", "write", "bash"]);
  for (const level of ["gated", "restrained", "eager"]) {
    const texts = [["sessions", renderSessions(undefined, level, [...direct])]];
    assert.deepEqual(findDanglingReferences(texts, { known, available: direct }), [], level);
  }
});

test("the checker reads snake_case names, calls, backticks and slash lists but not prose or attribute calls", () => {
  const options = { known: new Set(["tool_call", "bash", "glob", "read"]), available: new Set() };
  const names = (text) => findDanglingReferences([["t", text]], options).map(({ name }) => name).sort();
  assert.deepEqual(names("Use tool_call, `bash`, glob(x) and read/glob."), ["bash", "glob", "read", "tool_call"]);
  assert.deepEqual(names("Read the bash manual; file.read(x); a read of tool calls"), []);
});
