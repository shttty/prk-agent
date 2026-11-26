import assert from "node:assert/strict";
import { test } from "node:test";
import { fauxAssistantMessage, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import { STATIC_KERNEL_HELPERS } from "../../../src/codemode/module-catalog/cold-catalog.ts";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { verifyPromptReferences } from "../../fixtures/prompt/verify-prompt-references.mjs";

// session_list is switched to lazy: callable and findable, but not in the catalog.
const CONFIG = { session: { workerTools: "code", capabilities: { "lazy:tool:session_list": true } } };
const CELLS = String.raw`import ast, json
names = [item["name"] for item in gateway.describe()]
assert "session_list" in names and "ask" in names, names
assert all("\n\n" not in item["description"] for item in gateway.describe()), "descriptions are first paragraphs"
stub = gateway.describe("session_list")
assert isinstance(stub, str), stub
ast.parse(stub)
print("DESCRIBE_OK", len(names))
print("STUB", json.dumps(stub))
hits = gateway.search("list the sessions I can reach", limit=3)
assert 1 <= len(hits) <= 3 and set(hits[0]) == {"name", "description", "stub"}, hits
assert hits[0]["name"] == "session_list", [hit["name"] for hit in hits]
ast.parse(hits[0]["stub"])
print("SEARCH", json.dumps([hit["name"] for hit in hits]))
for call in ("gateway.describe('no_such_tool')", "gateway.search('')"):
    try:
        eval(call)
    except Exception as error:
        print("ERR", call, type(error).__name__)
for entry in gateway.describe():
    ast.parse(gateway.describe(entry["name"]))
print("ALL_STUBS_PARSE")`;

test("gateway.describe(name) returns the stub, describe() every callable tool, search(query) ranked stubs, and the catalog is stable", async (t) => {
  let messages;
  const f = await gatewayFixture(t, { config: CONFIG, answer(context) { messages = context.messages; return fauxAssistantMessage("Observed."); } });
  await f.stageArtifacts();
  const id = await f.create();
  const catalog = async (message) => {
    await f.complete(id, await f.send(id, message));
    return /<tool_catalog>\n[\s\S]*?\n<\/tool_catalog>/.exec(getSystemMessageText(getCurrentSystemMessage(messages)))?.[0] ?? assert.fail("no tool_catalog section");
  };
  const cell = async (code) => {
    const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
    assert.equal((await f.complete(id, receipt)).status, "completed");
    return text(f.state(id).messages.findLast((message) => message.role === "toolResult"));
  };

  const cold = await catalog("Before any cell");
  const out = await cell(CELLS);
  assert.match(out, /^DESCRIBE_OK \d+$/m, out);
  assert.match(out, /^SEARCH \["session_list"/m, out);
  assert.match(out, /^ERR gateway\.describe\('no_such_tool'\) RuntimeError$/m, out);
  assert.match(out, /^ERR gateway\.search\(''\) RuntimeError$/m, out);
  assert.match(out, /^ALL_STUBS_PARSE$/m, out);
  const stub = JSON.parse(/^STUB (.*)$/m.exec(out)[1]);
  assert.match(stub, /def session_list\(/);
  assert.match(stub, /\) -> [^\n]+:\n    """/);

  assert.equal(await catalog("After the cell"), cold, "the catalog before the first cell and after it are the same bytes");
  assert.equal(await catalog("Once more"), cold, "the same tool set renders the same bytes");
  const defs = [...cold.matchAll(/^def (\w+)\(/gm)].map((match) => match[1]);
  assert(defs.includes("ask"), "a listed tool carries its stub in the catalog");
  assert(!defs.includes("session_list"), "a lazy tool is not listed");
  const kernelNames = new Set(STATIC_KERNEL_HELPERS.map(({ name }) => name));
  assert.deepEqual(defs.filter((name) => kernelNames.has(name)), [], "a catalog def never shadows a kernel function");
  const kernelTypes = new Set(STATIC_KERNEL_HELPERS.flatMap(({ types }) => Object.keys(types ?? {})));
  const classes = [...cold.matchAll(/^(?:class (\w+)\(TypedDict\)|(\w+) = TypedDict)/gm)].map((match) => match[1] ?? match[2]);
  assert.deepEqual(classes.filter((name) => kernelTypes.has(name)), [], "generated TypedDicts never reuse a kernel TypedDict name");
  await verifyPromptReferences(f, id, messages);
  console.log(`tool_catalog: ${cold.length} chars, ${defs.length} stubs`);
});
