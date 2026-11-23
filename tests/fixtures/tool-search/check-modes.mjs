import assert from "node:assert/strict";
import { probeContract } from "./probe-contract.mjs";

export async function checkModes(fixture) {
  const { action, catalog, run, toggle, host, sessionId: worker } = fixture;
  const initial = host.state(worker);
  await action("tool-mode", { mode: "code" });
  const code = (await run()).requests[0];
  assert.deepEqual(code.tools, ["kernel_code", "kernel_interrupt", "kernel_read"], "Code mode declares only kernel tools, not meta tools");
  assert.match(code.prompt, /search_lazy[^\n]*Inspect the cobalt payload\./);
  assert.match(code.prompt, /search_description[^\n]*Inspect the amber payload\./);
  assert(code.prompt.includes(probeContract.guidelines[0]), "Code-mode hidden guidelines still reach the prompt");
  assert(!code.prompt.includes("Do not put this second sentence"));
  await action("tool-mode", { mode: "direct" });
  const inventory = await catalog();
  for (const entry of inventory.entries) if (entry.lazy?.available) await toggle(entry.lazy.id, false);
  const resident = (await run()).requests[0];
  assert(!resident.tools.includes("tool_search"), "No hidden tools means no tool_search declaration");
  assert(!resident.tools.includes("tool_call"), "No hidden tools means no tool_call declaration");
  for (const name of ["search_lazy", "search_description", "search_default", "search_resident", "search_model_only"]) {
    assert(resident.tools.includes(name), `All-enabled resident declaration includes ${name}`);
  }
  assert(!resident.tools.includes("search_disabled"), "Resident declaration changes do not enable a disabled tool");
  assert(!resident.prompt.includes("Tools available on demand:"), "No empty demand-loading inventory remains");
  const repeated = (await run()).requests[0];
  assert.equal(repeated.declarations, resident.declarations, "All-resident declarations are also byte-stable");
  await action("tool-mode", { mode: "code" });
  const codeAfterLazyChanges = (await run()).requests[0];
  assert.equal(codeAfterLazyChanges.declarations, code.declarations, "Code-mode complete declarations are unchanged by direct-mode lazy settings");
  assert.deepEqual(codeAfterLazyChanges.tools, ["kernel_code", "kernel_interrupt", "kernel_read"]);
  assert.match(codeAfterLazyChanges.prompt, /search_lazy[^\n]*Inspect the cobalt payload\./);
  await action("tool-mode", { mode: "direct" });
  const restored = (await run()).requests[0];
  assert.equal(restored.declarations, resident.declarations, "Returning to direct restores the same all-resident declaration without a reload");
  const after = host.state(worker);
  assert.equal(after.streamId, initial.streamId);
  assert.equal(after.sessionId, initial.sessionId);
  assert.equal(after.kernel.kernelId, initial.kernel.kernelId);
  assert.equal((await catalog()).requiresReload, false);
}
