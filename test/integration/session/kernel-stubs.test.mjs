import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { fauxAssistantMessage, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import { STATIC_KERNEL_HELPERS } from "../../../src/codemode/module-catalog/cold-catalog.ts";
import { kernelToolCatalog } from "../../../src/codemode/module-catalog/read-kernel-tool-catalog.ts";
import { renderStubs } from "../../../src/plugins/kernel/prompt/kernel/render-stubs.ts";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { startCompletionsEndpoint } from "../../fixtures/models/start-completions-endpoint.mjs";
import { verifyPromptReferences } from "../../fixtures/prompt/verify-prompt-references.mjs";

const COLD = new URL("../../../src/codemode/module-catalog/cold-catalog.json", import.meta.url);
const CHECKS = String.raw`import base64, json, os, sys, tempfile, typing
from typing import Annotated, Any, Literal, Optional, TypedDict, Union

def check(value, annotation, where):
    args = typing.get_args(annotation)
    if typing.get_origin(annotation) is Annotated:
        return check(value, args[0], where)
    if hasattr(annotation, "__required_keys__"):
        hints = typing.get_type_hints(annotation, include_extras=True)
        assert set(value) <= set(hints), (where, "undeclared", sorted(set(value) - set(hints)))
        assert annotation.__required_keys__ <= set(value), (where, "missing", sorted(annotation.__required_keys__ - set(value)))
        for key, item in value.items():
            check(item, hints[key], where + "." + key)
    elif typing.get_origin(annotation) is list:
        for item in value:
            check(item, args[0], where + "[]")

def verify(function, result):
    check(result, typing.get_type_hints(function, include_extras=True)["return"], function.__name__)

folder = tempfile.mkdtemp()
path = os.path.join(folder, "a.txt")
verify(write, write(path, "alpha\nbeta\n"))
shown = read(path)
verify(read, shown)
ref = shown["lines"][0]["ref"]
verify(edit, edit(path, [{"op": "replace", "start": ref, "end": ref, "text": "ALPHA"}]))
verify(grep, grep("beta", path, context=1))
verify(ls, ls(folder))
verify(glob, glob("*.txt", folder))
verify(bash, bash("echo hi"))
png = os.path.join(folder, "p.png")
with open(png, "wb") as stream:
    stream.write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="))
verify(read, read(png))
print("TYPED_RESULTS_OK")

class Point(TypedDict):
    x: int
    y: Annotated[Optional[int], "None when unknown"]

class Other(TypedDict):
    z: int
Other.__name__ = "Point"

def sample(a, b: Optional[Point] = None, *, kind: Literal["x", "y"] = "x", tags: list[Union[int, str]] = ()) -> Point:
    """Sample.

    Details stay out of the stub."""

def other(a: Other) -> None: ...

loader = sys.modules["_prk_tool_loader"]
known = {}
print("DESCRIBED", json.dumps(loader._describe_function("sample", sample, known)))
try:
    loader._describe_function("other", other, known)
except ValueError as error:
    print("CONFLICT", error)`;

/** What the cold catalog may say about a function: everything the prompt and the tool pages use, without machine paths. */
const described = (helpers) => JSON.parse(JSON.stringify(helpers.filter((helper) => helper.available !== false && !helper.moduleOnly)
  .map(({ name, signature, description, module, stub, types }) => ({ name, signature, description, module, stub, types }))
  .sort((a, b) => (a.name < b.name ? -1 : 1))));

test("the cold catalog is the kernel's own report, results match their TypedDicts, and help() has the details", async (t) => {
  let messages;
  const f = await gatewayFixture(t, { config: { session: { workerTools: "code" } }, answer(context) { messages = context.messages; return fauxAssistantMessage("Observed."); } });
  await f.stageArtifacts();
  const id = await f.create();
  const cell = async (code) => {
    const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
    assert.equal((await f.complete(id, receipt)).status, "completed");
    return text(f.state(id).messages.findLast((message) => message.role === "toolResult"));
  };

  const checked = await cell(CHECKS);
  assert.match(checked, /^TYPED_RESULTS_OK$/m, checked);
  const stub = JSON.parse(/^DESCRIBED (.*)$/m.exec(checked)[1]);
  assert.deepEqual(stub, {
    signature: "(a: Any, b: Point | None = None, *, kind: Literal['x', 'y'] = 'x', tags: list[int | str] = ...) -> Point",
    description: "Sample.",
    stub: "def sample(\n    a: Any,\n    b: Point | None = None,\n    *,\n    kind: Literal['x', 'y'] = 'x',\n    tags: list[int | str] = ...,\n) -> Point:\n    \"\"\"Sample.\"\"\"",
    types: { Point: "class Point(TypedDict):\n    x: int\n    y: int | None  # None when unknown" },
  });
  assert.match(checked, /^CONFLICT Two different TypedDicts are named Point$/m);

  const [editHelp, readHelp] = [await cell("help(edit)"), await cell("help(read)")];
  for (const detail of ["BOM/CRLF", "1 MiB", "cooperative file lock"]) assert(editHelp.includes(detail), `help(edit) lacks ${detail}:\n${editHelp}`);
  for (const detail of ["its ref still edits the whole line", "read(path: str, offset: Optional[int] = None"]) assert(readHelp.includes(detail), `help(read) lacks ${detail}:\n${readHelp}`);

  const runtime = described(kernelToolCatalog(f.root, f.target));
  if (process.env.PRK_UPDATE_COLD_CATALOG) {
    const entries = runtime.map((entry) => ({ ...entry, ...(entry.module ? {} : { source: "PRK kernel prelude" }), available: true }));
    writeFileSync(COLD, `${JSON.stringify(entries, null, 2)}\n`);
    return;
  }
  assert.deepEqual(described(STATIC_KERNEL_HELPERS), runtime, "cold-catalog.json is stale: run with PRK_UPDATE_COLD_CATALOG=1");
  assert.equal(renderStubs(STATIC_KERNEL_HELPERS), renderStubs(kernelToolCatalog(f.root, f.target)));
  assert.deepEqual(runtime.map(({ name }) => name), ["bash", "disk_usage", "edit", "glob", "grep", "library_sync", "ls", "phase", "read", "tool", "tool_bin", "write"]);
  assert.match(getSystemMessageText(getCurrentSystemMessage(messages)), /^def read\(/m, "code mode offers the kernel stubs");
  await verifyPromptReferences(f, id, messages);
});

test("the <kernel> section before the first cell is byte-identical to the one after it", async (t) => {
  const endpoint = await startCompletionsEndpoint(t, (body) => {
    const last = body.messages.at(-1);
    return last.role === "user" && JSON.stringify(last.content).includes("RUN KERNEL") ? { name: "kernel_code", args: { code: "print(1)", title: "probe" } } : "Endpoint reply.";
  });
  const f = await gatewayFixture(t, { web: true, endpoint, config: { session: { workerTools: "code" } } });
  await f.stageArtifacts();
  const id = await f.create();
  const section = async () => {
    const { latest } = await (await fetch(`${f.url}/api/sessions/${id}/prompt`, { headers: { Origin: f.url } })).json();
    const [kernel] = /<kernel>\n[\s\S]*?\n<\/kernel>/.exec(latest.system.text);
    assert.equal(kernel.length, latest.system.sections.entries.find(({ key }) => key === "kernel").chars);
    return kernel;
  };
  const turn = async (message) => assert.equal((await f.complete(id, await f.send(id, message))).status, "completed");
  await turn("Before any cell");
  const cold = await section();
  await turn("RUN KERNEL");
  await turn("After a cell");
  const warm = await section();
  assert.equal(warm, cold);
  assert.match(cold, /^def read\(path: str, offset: int \| None = None, limit: int \| None = None\) -> ReadResult:$/m);
  console.log(`kernel section: ${cold.length} chars\n${cold}`);
});
