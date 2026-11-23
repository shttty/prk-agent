import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTarget } from "./fixtures/create-target.mjs";
import { createWebFixture } from "./fixtures/create-web-fixture.mjs";

const target = await createTarget(process.argv[2] ?? "local");
let fixture;
try {
  fixture = await createWebFixture(target, { files: { max_edit_bytes: 64 } });
  const run = async (code) => {
    const admission = await fixture.host.session(fixture.sessionId).submit({ requestId: crypto.randomUUID(), message: `S4_CELL ${JSON.stringify({ code, title: "S4 files Gateway acceptance" })}` });
    assert.equal(admission.accepted, true);
    const completion = await admission.completion;
    const detail = fixture.host.state(fixture.sessionId);
    assert.equal(completion.status, "completed", JSON.stringify({ completion, kernel: detail.kernel }));
    const result = detail.messages.filter(({ role, toolName }) => role === "toolResult" && toolName === "kernel_code").at(-1);
    assert(result, "SDK kernel_code result missing");
    assert.equal(Boolean(result.isError), false, JSON.stringify(result));
    return result;
  };
  const contract = await readFile(new URL("../fixtures/kernel-filetools-contract.py", import.meta.url), "utf8");
  if (!process.argv.includes("--clear-only")) await run(contract);
  await run("from pathlib import Path\nwrite('clear-reference.txt','before\\n')\nsaved_ref=read('clear-reference.txt')['lines'][0]['ref']\nPath('saved-reference.txt').write_text(saved_ref)");
  await fixture.host.kernelClear(fixture.sessionId);
  await run("from pathlib import Path\nref=Path('saved-reference.txt').read_text()\nedit('clear-reference.txt',[{'op':'replace','start':ref,'end':ref,'text':'after'}])\nassert Path('clear-reference.txt').read_text()=='after\\n'");
  const history = fixture.host.state(fixture.sessionId);
  const names = history.messages.filter(({ role }) => role === "toolResult").map(({ toolName }) => toolName);
  assert(names.includes("kernel_code"));
  assert(!names.includes("write"), "nested SDK file callback must not become a second top-level result");
  console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", gatewayFiles: true, fullExistingContract: !process.argv.includes("--clear-only"), clearRetainsHashlines: true }));
} finally { await fixture?.close(); await target.close(); }
