import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkKernelSwitches({ run, action, host, sessionId: worker, prompts, text, home }) {
  await run(`from prk_tools import automatic, files
from prk_tools.files.file_state import _ctx as files_state
retained_switch_value = 7013
retained_files = files
retained_session = files_state._session
retained_automatic = automatic_probe
write('switch-proof.txt', 'before\\n')
retained_view = read('switch-proof.txt')
retained_ref = retained_view['lines'][0]['ref']
retained_helpers = {name: globals()[name] for name in ('bash', 'ls', 'glob', 'read', 'edit', 'write', 'grep')}
retained_calls = {
    'bash': lambda: retained_helpers['bash']('printf forbidden > switch-forbidden.txt'),
    'ls': lambda: retained_helpers['ls'](),
    'glob': lambda: retained_helpers['glob']('*'),
    'read': lambda: files.read('switch-proof.txt'),
    'edit': lambda: files.edit('switch-proof.txt', [{'op': 'replace', 'start': retained_ref, 'end': retained_ref, 'text': 'forbidden'}]),
    'write': lambda: files.write('switch-proof.txt', 'forbidden\\n'),
    'grep': lambda: files.grep('before', 'switch-proof.txt'),
}
def assert_disabled(name, call):
    try:
        call()
    except RuntimeError as error:
        assert name in str(error) and 'disabled for this session' in str(error), str(error)
    else:
        raise AssertionError('disabled function executed: ' + name)`);
  const kernelId = host.state(worker).kernel.kernelId;
  await action("capabilities", { changes: [{ id: "kernel:automatic_probe", enabled: false }] });
  await run("assert automatic.calls == 1\nassert_disabled('automatic_probe', retained_automatic)\nassert_disabled('automatic_probe', automatic.automatic_probe)\nassert automatic.calls == 1\nassert callable(automatic_probe)");
  assert(!prompts.at(-1).includes("AUTOMATIC_MODULE_DESCRIPTION_7013"));
  assert.equal((await action("capabilities")).requiresReload, false);
  await action("capabilities", { changes: [{ id: "kernel:automatic_probe", enabled: true }] });
  await run("assert retained_automatic() == 42\nassert automatic.calls == 2");
  assert(prompts.at(-1).includes("AUTOMATIC_MODULE_DESCRIPTION_7013"));
  await action("capabilities", { changes: [{ id: "kernel:module:files", enabled: false }] });
  const moduleDisabled = await run(`file_args = {
    'read': ('switch-proof.txt',),
    'edit': ('switch-proof.txt', [{'op': 'replace', 'start': retained_ref, 'end': retained_ref, 'text': 'forbidden'}]),
    'write': ('switch-proof.txt', 'forbidden\\n'),
    'grep': ('before', 'switch-proof.txt'),
}
shown_before_module_calls = {path: refs.copy() for path, refs in retained_session.shown.items()}
for name in ('read', 'edit', 'write', 'grep'):
    assert callable(getattr(files, name)) and callable(retained_helpers[name])
    assert_disabled(name, retained_calls[name])
    assert_disabled(name, lambda name=name: retained_helpers[name](*file_args[name]))
assert retained_switch_value == 7013
assert retained_files is files and retained_session is files_state._session
assert retained_session.shown == shown_before_module_calls`);
  assert(!moduleDisabled.details.callbacks.some((callback) => ["read", "edit", "write"].includes(callback.name)), "The files module switch rejects before SDK file callbacks");
  assert.equal(await readFile(join(home, "switch-proof.txt"), "utf8"), "before\n", "Disabling the files module performs no writes");
  const moduleCatalog = await action("capabilities");
  assert.equal(moduleCatalog.entries.find((entry) => entry.id === "kernel:module:files")?.enabled, false);
  assert.equal(moduleCatalog.entries.find((entry) => entry.id === "kernel:module:files")?.loaded, true, "The warm catalog retains the resident files module switch");
  for (const name of ["read", "edit", "write", "grep"]) assert.equal(moduleCatalog.entries.find((entry) => entry.id === `kernel:${name}`)?.enabled, false);
  assert.equal(moduleCatalog.requiresReload, false);
  await action("capabilities", { changes: [{ id: "kernel:module:files", enabled: true }] });
  await run(`assert retained_files is files and retained_session is files_state._session
assert retained_helpers['read']('switch-proof.txt')['lines'][0]['text'] == 'before'
files.edit('switch-proof.txt', [{'op': 'replace', 'start': retained_ref, 'end': retained_ref, 'text': 'module restored'}])
assert files.read('switch-proof.txt')['lines'][0]['text'] == 'module restored'
retained_helpers['write']('switch-proof.txt', 'before\\n')
retained_ref = retained_helpers['read']('switch-proof.txt')['lines'][0]['ref']
assert retained_helpers['grep']('before', 'switch-proof.txt')['matches'] == 1
assert retained_switch_value == 7013`);
  assert.equal((await action("capabilities")).requiresReload, false);
  for (const name of ["bash", "ls", "glob", "read", "edit", "write", "grep"]) {
    await action("capabilities", { changes: [{ id: `kernel:${name}`, enabled: false }] });
    const denied = await run(`assert callable(globals()[${JSON.stringify(name)}])\nassert_disabled(${JSON.stringify(name)}, retained_calls[${JSON.stringify(name)}])`);
    assert(!denied.details.callbacks.some((callback) => ["read", "edit", "write"].includes(callback.name)), `${name} must fail before an SDK file callback`);
    assert.equal((await action("capabilities")).requiresReload, false);
    await action("capabilities", { changes: [{ id: `kernel:${name}`, enabled: true }] });
  }
  await run("assert retained_helpers['bash']('printf restored')['stdout'] == 'restored'\nassert 'switch-proof.txt' in retained_helpers['ls']()['entries']\nassert 'switch-proof.txt' in retained_helpers['glob']('*')['files']\nassert retained_helpers['grep']('before', 'switch-proof.txt')['matches'] == 1");
  await action("local-tools", { enabled: true });
  const native = await run(`assert retained_files is files and retained_session is files_state._session
for name in ('read', 'edit', 'write', 'grep'):
    assert_disabled(name, retained_calls[name])
assert retained_switch_value == 7013
assert 'read' in {tool['name'] for tool in gateway.describe()}
assert 'before' in gateway.read(path='switch-proof.txt')`);
  assert.equal(native.details.callbacks.filter((callback) => callback.name === "read").length, 1, "Only the explicit native read reaches the SDK");
  assert.equal((await action("capabilities")).requiresReload, false);
  assert.equal(await readFile(join(home, "switch-proof.txt"), "utf8"), "before\n", "Disabled file calls never write");
  await assert.rejects(readFile(join(home, "switch-forbidden.txt")), (error) => error.code === "ENOENT");
  await action("local-tools", { enabled: false });
  const restored = await run(`assert retained_switch_value == 7013
assert retained_files is files and retained_session is files_state._session
assert retained_helpers['read']('switch-proof.txt')['lines'][0]['text'] == 'before'
retained_helpers['edit']('switch-proof.txt', [{'op': 'replace', 'start': retained_ref, 'end': retained_ref, 'text': 'after'}])
assert retained_helpers['read']('switch-proof.txt')['lines'][0]['text'] == 'after'
retained_helpers['write']('switch-proof.txt', 'restored\\n')
assert 'read' not in {tool['name'] for tool in gateway.describe()}
try:
    gateway.read(path='switch-proof.txt')
except RuntimeError as error:
    assert 'read 在本会话已关闭' in str(error), str(error)
else:
    raise AssertionError('ordinary gateway.read bypassed the native switch')
assert retained_helpers['read']('switch-proof.txt')['lines'][0]['text'] == 'restored'`);
  assert(restored.details.callbacks.some((callback) => callback.name === "read" && callback.status === "error"), "Ordinary read reaches and is rejected by the SDK hook");
  assert(restored.details.callbacks.filter((callback) => callback.name === "read" && callback.status === "ok").length >= 3, "Dedicated file callbacks remain usable before and after ordinary read rejection");
  assert.equal(await readFile(join(home, "switch-proof.txt"), "utf8"), "restored\n");
  assert.equal(host.state(worker).kernel.kernelId, kernelId, "Every switch preserves the same real kernel");
  assert.equal((await action("capabilities")).requiresReload, false);
}
