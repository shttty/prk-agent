import assert from "node:assert/strict";
import { test } from "node:test";
import { projectDeclarations } from "../../../../src/sessions/tool-declarations/project-declarations.ts";

const tool = (name, options = {}) => ({ name, description: `Use ${name}. More detail.`,
  parameters: { type: "object", properties: {} }, exposure: "direct",
  native: false, enabled: true, lazy: false, callable: true, ...options });

test("direct projects resident plus meta declarations while lazy tools stay in the input inventory", () => {
  const tools = [tool("resident"), tool("lazy", { lazy: true, promptSnippet: "Do the short action.", promptGuidelines: ["LAZY_RULE"] }),
    tool("disabled", { enabled: false, lazy: true }), tool("withdrawn", { exposure: "hidden", lazy: true })];
  const original = structuredClone(tools);
  const projected = projectDeclarations({ mode: "direct", tools });
  assert.deepEqual(projected.declared, ["resident", "tool_search", "tool_call"]);
  assert.deepEqual(projected.hidden, [tools[1]]);
  assert.match(projected.prompt, /lazy[^\n]*Do the short action\./);
  assert(projected.prompt.includes("LAZY_RULE"));
  assert(!projected.prompt.includes("disabled"));
  assert(!projected.prompt.includes("withdrawn"));
  assert.match(projected.prompt, /tool_search\(query\)/);
  assert.match(projected.prompt, /tool_call\(name, args\)/);
  assert.deepEqual(tools, original, "Projection neither activates, changes exposure, nor rewrites the registry");
  assert.deepEqual(projectDeclarations({ mode: "direct", tools }), projected, "Identical input gives the same ordered declaration and prompt");
});

test("all seven native tools and uncallable model-only tools remain declared despite a requested lazy loading", () => {
  const native = ["read", "bash", "edit", "write", "grep", "find", "ls"].map((name) => tool(name, { native: true, lazy: true }));
  const modelOnly = tool("model_only", { exposure: "model-only", lazy: true, callable: false });
  const result = projectDeclarations({ mode: "direct", tools: [...native, modelOnly] });
  assert.deepEqual(result.declared, ["read", "bash", "edit", "write", "grep", "find", "ls", "model_only"]);
  assert.deepEqual(result.hidden, []);
  assert.equal(result.prompt, "", "No hidden tools means no meta-tool instructions or empty inventory");
});

test("meta registrations never create their own catalog projection or duplicates", () => {
  const meta = [tool("tool_search"), tool("tool_call")];
  assert.deepEqual(projectDeclarations({ mode: "direct", tools: [...meta, tool("resident")] }).declared, ["resident"]);
  const projected = projectDeclarations({ mode: "direct", tools: [...meta, tool("lazy", { lazy: true })] });
  assert.deepEqual(projected.declared, ["tool_search", "tool_call"]);
  assert.deepEqual(projected.hidden.map(({ name }) => name), ["lazy"]);
});

test("inventory uses a collapsed promptSnippet or first description sentence, retaining unique hidden guidelines", () => {
  const result = projectDeclarations({ mode: "direct", tools: [
    tool("snippet", { lazy: true, promptSnippet: "Short\n  action.", promptGuidelines: ["SAME_RULE"] }),
    tool("fallback", { lazy: true, description: "First sentence.\nSecond sentence must be omitted.", promptGuidelines: ["SAME_RULE", "OTHER_RULE"] }),
    tool("disabled", { enabled: false, lazy: true, promptGuidelines: ["DISABLED_RULE"] }),
  ] });
  assert.match(result.prompt, /snippet[^\n]*Short action\./);
  assert.match(result.prompt, /fallback[^\n]*First sentence\./);
  assert(!result.prompt.includes("Second sentence"));
  assert.equal(result.prompt.match(/SAME_RULE/g)?.length, 1);
  assert(result.prompt.includes("OTHER_RULE"));
  assert(!result.prompt.includes("DISABLED_RULE"));
});

test("code declarations ignore lazy settings, keep native tools and kernel_code, and list callable descriptions", () => {
  const tools = [tool("kernel_code", { exposure: "model-only", callable: false }), tool("read", { native: true }),
    tool("callable", { promptSnippet: "Run a useful action.", promptGuidelines: ["CALLABLE_RULE"] }),
    tool("model_only", { exposure: "model-only", callable: false }), tool("disabled", { enabled: false }), tool("tool_search"), tool("tool_call")];
  const projected = projectDeclarations({ mode: "code", tools });
  assert.deepEqual(projected.declared, ["kernel_code", "read"]);
  assert.deepEqual(projected.hidden.map(({ name }) => name), ["callable", "model_only"]);
  assert.match(projected.prompt, /callable[^\n]*Run a useful action\./);
  assert(projected.prompt.includes("CALLABLE_RULE"));
  assert(!projected.prompt.includes("model_only"), "Code inventory advertises only callable tools");
  assert(!projected.prompt.includes("tool_search"));
  assert(!projected.prompt.includes("tool_call("));
  const lazy = projectDeclarations({ mode: "code", tools: tools.map((entry) => ({ ...entry, lazy: true })) });
  assert.deepEqual(lazy.declared, projected.declared, "Lazy settings do not change code declarations");
  assert.deepEqual(lazy.hidden.map(({ name }) => name), projected.hidden.map(({ name }) => name), "Lazy settings do not change code-hidden identities");
  assert.equal(lazy.prompt, projected.prompt, "Code descriptions and guidelines are independent of lazy settings");
});

test("resident guidelines follow current permission without leaking closed rules", () => {
  const resident = tool("resident", { promptGuidelines: ["RESIDENT_RULE"] });
  const enabled = projectDeclarations({ mode: "direct", tools: [resident] });
  assert(enabled.prompt.includes("RESIDENT_RULE"));
  const disabled = projectDeclarations({ mode: "direct", tools: [{ ...resident, enabled: false }] });
  assert.deepEqual(disabled.declared, []);
  assert(!disabled.prompt.includes("RESIDENT_RULE"));
});
