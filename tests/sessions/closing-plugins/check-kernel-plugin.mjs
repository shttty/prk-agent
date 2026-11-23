import assert from "node:assert/strict";

export async function checkKernelPlugin(fixture, worker) {
  const { host, run, action, toggle } = fixture;
  const id = "group:tools:package:<inline:kernel>";
  const catalog = () => action(worker, "capabilities");
  const kernel = (inventory) => inventory.entries.find(({ id }) => id === "tool:kernel_code");
  const topic = (request, name) => new RegExp(`<${name}>\\n[\\s\\S]*?\\n</${name}>`, "u").exec(request.instructions)?.[0];
  for (const inventory of [(await host.capabilitiesList()).catalog, await catalog()]) {
    assert(!JSON.stringify(inventory).includes("group:tools:prk"), "Real global and worker inventories contain no retired PRK group");
    assert(inventory.groups.some((group) => group.id === id));
    assert.equal(inventory.groups.find((group) => group.id === id).name, "kernel");
    assert.equal(kernel(inventory).group, id);
    assert.equal(kernel(inventory).groupLabel, "kernel");
    assert.equal(kernel(inventory).source, "kernel");
    assert.equal(kernel(inventory).exposure, "model-only");
    assert.equal(kernel(inventory).lazy.defaultEnabled, false);
    assert.equal(kernel(inventory).lazy.available, false, "kernel_code retains model-only lazy ineligibility");
  }
  await run(worker, "kernel_code", { code: "closing_plugin_sentinel = 31847\nprint('CLOSING_KERNEL_REAL_31847')" });
  const retained = structuredClone(host.state(worker));
  assert(retained.kernel?.kernelId, "Retention proof requires a real live kernel");
  const resident = (await run(worker)).request;
  assert(resident.tools.some(({ name }) => name === "kernel_code"));
  for (const name of ["kernel", "gateway_calls"]) assert(topic(resident, name), `${name} comes from its enabled plugin`);
  await toggle(worker, id, false);
  const disabled = (await run(worker)).request, off = await catalog();
  assert.equal(kernel(off).enabled, false);
  assert.equal(kernel(off).loaded, true, "Disable must not remove the SDK registration");
  assert.equal(kernel(off).exposure, "model-only");
  assert.equal(off.requiresReload, false);
  assert(!disabled.tools.some(({ name }) => name === "kernel_code"));
  for (const name of ["kernel", "gateway_calls"]) assert.equal(topic(disabled, name), undefined, `${name} disappears when kernel plugin is off`);
  const denied = await run(worker, "kernel_code", { code: "raise AssertionError('disabled kernel executed')" }, true);
  assert.match(denied.text, /kernel_code 在本会话已关闭/u, "The direct model call must hit the shared permission hook");
  await toggle(worker, id, true);
  const restored = (await run(worker)).request;
  for (const name of ["kernel", "gateway_calls"]) assert.equal(topic(restored, name), topic(resident, name), "Re-enable preserves exact topic bytes");
  await run(worker, "kernel_code", { code: "assert closing_plugin_sentinel == 31847\nprint('CLOSING_KERNEL_RETAINED_31847')" });
  await action(worker, "tool-mode", { mode: "code" });
  assert.equal(kernel(await catalog()).locked, true, "Code mode still locks kernel_code");
  const rejection = await host.nativeAction(worker, { sessionId: worker, requestId: crypto.randomUUID(), action: "capabilities",
    args: { changes: [{ id: "tool:kernel_code", enabled: false }] } });
  assert.equal(rejection.status, "failed");
  assert.match(JSON.stringify(rejection), /required by the active tool mode/u);
  const code = await run(worker, "kernel_code", { code: "assert closing_plugin_sentinel == 31847" });
  assert(code.request.tools.some(({ name }) => name === "kernel_code"));
  await action(worker, "tool-mode", { mode: "direct" });
  const current = host.state(worker);
  assert.equal(current.streamId, retained.streamId, "Plugin and mode changes preserve the actual SDK host");
  assert.equal(current.sessionId, retained.sessionId);
  assert.equal(current.kernel.kernelId, retained.kernel.kernelId, "Re-enable resumes the same real kernel and variables");
  return { plugin: "kernel", group: id, directDenial: true, retainedKernel: true, codeModeLocked: true };
}
