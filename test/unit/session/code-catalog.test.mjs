import assert from "node:assert/strict";
import { test } from "node:test";
import { createCodemodeExtension } from "@earendil-works/pi-coding-agent";
import { renderCodeCatalog } from "../../../src/sessions/tool-declarations/code-catalog/render-code-catalog.ts";
import { selectCatalog } from "../../../src/sessions/tool-declarations/code-catalog/select-catalog.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { projectDeclarations } from "../../../src/sessions/tool-declarations/project-declarations.ts";

const tool = (name, over = {}) => ({ name, description: `Does ${name}.`, parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] }, exposure: "direct", lazy: false, group: "group:a", ...over });
const names = (text) => [...text.matchAll(/^def (\w+)\(/gm)].map((match) => match[1]);

/** Pi's own codemode tool, asked for its description of these tools under a budget: the names of the tool sections it lists. */
function piListed(tools, namespaces, inlineBudget) {
  let registered;
  createCodemodeExtension({ inlineBudget, mode: "on", models: false })({ registerTool: (definition) => { registered = definition; }, getSettings: () => ({}), getAllTools: () => [] });
  const agentTools = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
  const { descriptions } = registered.prepareLoadout({
    declared: [], callable: agentTools, registered: agentTools,
    getExposure: () => "codemode", getNamespace: (name) => namespaces.get(name), getPromptGuidelines: () => [],
  });
  return [...descriptions.codemode.matchAll(/^### `(\w+)`/gm)].map((match) => match[1]);
}

test("selectCatalog places the same tools as Pi's codemode description under every budget", () => {
  const sizes = [10, 40, 90, 160, 250, 400, 650, 900];
  const tools = Array.from({ length: 24 }, (_, index) => tool(`t${String(index).padStart(2, "0")}`, {
    description: `Tool ${index}. ${"word ".repeat(sizes[(index * 5) % sizes.length])}`, group: ["", "group:a", "group:b", "group:c"][index % 4] || undefined,
  }));
  const namespaces = new Map(tools.filter(({ group }) => group).map(({ name, group }) => [name, { name: group }]));
  let registered;
  createCodemodeExtension({ inlineBudget: 1e9, mode: "on", models: false })({ registerTool: (definition) => { registered = definition; }, getSettings: () => ({}), getAllTools: () => [] });
  const agentTools = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
  const full = registered.prepareLoadout({ declared: [], callable: agentTools, registered: agentTools, getExposure: () => "codemode", getNamespace: () => undefined, getPromptGuidelines: () => [] });
  const sections = full.descriptions.codemode.split("Nested tools:\n\n")[1].split(/\n\n(?=### `)/u);
  const cost = new Map(sections.map((section) => [/^### `(\w+)`/u.exec(section)[1], Math.ceil(section.length / 4)]));
  assert.equal(cost.size, tools.length);
  const groups = [...new Set(tools.map(({ group }) => group ?? ""))].sort().map((group) => ({ entries: tools.filter((item) => (item.group ?? "") === group).map(({ name }) => ({ name, cost: cost.get(name) })) }));
  const total = [...cost.values()].reduce((sum, value) => sum + value, 0);
  const seen = new Set();
  for (let budget = 0; budget <= total + 20; budget += 37) {
    const pi = piListed(tools, namespaces, budget);
    const ours = [...selectCatalog(groups, budget)];
    assert.deepEqual(ours.sort(), [...pi].sort(), `budget ${budget}`);
    seen.add(pi.length);
  }
  assert(seen.size > 8, `the budgets must pick different amounts, saw ${[...seen]}`);
  assert.equal(selectCatalog(groups, undefined).size, tools.length);
});

test("every group places its cheapest tool before any group places a second, ungrouped tools first", () => {
  const entry = (name, cost) => ({ name, cost });
  const groups = [{ entries: [entry("loose-big", 30), entry("loose-small", 5)] }, { entries: [entry("a-big", 20), entry("a-small", 4)] }, { entries: [entry("b-only", 8)] }];
  assert.deepEqual([...selectCatalog(groups, 17)], ["loose-small", "a-small", "b-only"]);
  assert.deepEqual([...selectCatalog(groups, 45)], ["loose-small", "a-small", "b-only", "a-big"]);
  assert.deepEqual([...selectCatalog(groups, 50)], ["loose-small", "a-small", "b-only", "loose-big"]);
  assert.deepEqual([...selectCatalog(groups, 3)], []);
});

test("a deferred tool and a tool the lazy switch is on for are not listed; every other callable tool is, and switching one tool changes only it", () => {
  const tools = [tool("alpha"), tool("beta", { exposure: "deferred" }), tool("gamma", { lazy: true }), tool("delta")];
  const { text, listed } = renderCodeCatalog(tools, 3000);
  assert.deepEqual(listed, ["alpha", "delta"]);
  assert.deepEqual(names(text), ["alpha", "delta"]);
  const switched = renderCodeCatalog(tools.map((item) => (item.name === "gamma" ? { ...item, lazy: false } : item)), 3000);
  assert.deepEqual(names(switched.text), ["alpha", "delta", "gamma"]);
  assert.equal(switched.text.replace(/def gamma[\s\S]*?"""\n/u, ""), text);
  assert.match(text, /gateway\.search\(query\) or read a stub with gateway\.describe\(name\)\.$/);
});

test("the catalog depends only on the tool set: input order does not matter and the same input renders the same bytes", () => {
  const tools = ["zeta", "alpha", "mid", "beta"].map((name, index) => tool(name, { group: index % 2 ? "group:b" : "group:a", description: `${name} ${"x ".repeat(index * 40)}` }));
  const first = renderCodeCatalog(tools, 120);
  assert.equal(renderCodeCatalog([...tools].reverse(), 120).text, first.text);
  assert.equal(renderCodeCatalog(tools.map((item) => ({ ...item })), 120).text, first.text);
  assert(first.listed.length > 0 && first.listed.length < tools.length, "the budget must cut the list");
});

test("the budget counts a stub's TypedDicts and prompt guidelines; zero lists nothing but keeps the pointer to search", () => {
  const withGuidelines = tool("alpha", { promptGuidelines: ["Call alpha before beta"] });
  assert.match(renderCodeCatalog([withGuidelines], 3000).text, /"""Does alpha\.\n\n    - Call alpha before beta"""/);
  const empty = renderCodeCatalog([withGuidelines], 0);
  assert.deepEqual(empty.listed, []);
  assert.doesNotMatch(empty.text, /```/);
  assert.match(empty.text, /gateway\.search\(query\)/);
});

test("projectDeclarations: code mode lists stubs, direct mode keeps its one-line list and meta tools", () => {
  const base = (over) => ({ name: "x", description: "X.", parameters: { type: "object", properties: {} }, exposure: "direct", native: false, enabled: true, lazy: false, callable: true, ...over });
  const tools = [base({ name: "alpha", lazy: true, promptGuidelines: ["Alpha rule"] }), base({ name: "beta", promptGuidelines: ["Beta rule"] })];
  const code = projectDeclarations({ mode: "code", tools, inlineBudget: 3000 });
  assert.deepEqual(names(code.prompt), ["beta"]);
  assert(code.prompt.startsWith("Currently callable Gateway tools:\n```python\n"));
  assert.equal(code.prompt.split("Beta rule").length, 2, "a listed tool's guideline appears once, inside its stub");
  const direct = projectDeclarations({ mode: "direct", tools, inlineBudget: 3000 });
  assert.match(direct.prompt, /^Tools available on demand:\nalpha: X\.\nUse tool_search\(query\)/);
  assert.deepEqual(direct.declared, ["beta", "tool_search", "tool_call"]);
});

test("codemode.inlineBudget defaults to Pi's 3000 estimated tokens, accepts 0 and refuses negative or fractional values", () => {
  assert.equal(parsePrkConfig({}).codemode.inlineBudget, 3000);
  assert.equal(parsePrkConfig({ codemode: { inlineBudget: 0 } }).codemode.inlineBudget, 0);
  assert.equal(parsePrkConfig({ codemode: { inlineBudget: 1200 } }).codemode.inlineBudget, 1200);
  for (const bad of [-1, 1.5, "3000"]) assert.throws(() => parsePrkConfig({ codemode: { inlineBudget: bad } }), /codemode\.inlineBudget/);
});
