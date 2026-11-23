import assert from "node:assert/strict";
import { join } from "node:path";
import { waitForSessionCondition } from "../../sessions/derivation/wait-for-session-condition.mjs";

export async function checkGatewayValues({ host, home, sessionId: worker, run }) {
  const guard = `import json\ndef checked(name, args):\n    value = gateway.call(name, args)\n    assert isinstance(value, (dict, list, str, int, float, bool, type(None))), (name, type(value))\n    if isinstance(value, str):\n        try:\n            decoded = json.loads(value)\n        except (ValueError, TypeError):\n            pass\n        else:\n            assert not isinstance(decoded, (dict, list)), (name, 'JSON-encoded result', value)\n    return value\n`;
  const covered = new Set();
  const invoke = async (name, args, who = worker, assertion = "") => {
    await idle(who);
    const code = `${guard}\nvalue = checked(${JSON.stringify(name)}, json.loads(${JSON.stringify(JSON.stringify(args))}))\n${assertion}`;
    await run(who, code);
    covered.add(name);
  };
  const idle = async (name) => waitForSessionCondition(() => !host.session(name).getSnapshot().operation, `idle ${name}`);
  const child = (task) => host.workbench().sessions.find((entry) => entry.derivation?.task === task);
  const spawn = (task) => invoke("session_spawn", { context: "Isolated return-shape regression; remain idle until explicitly called.", tasks: [{ task, label: task, lifecycle: "persistent" }] });
  const catalogResult = await run(worker, "print('CALLABLES=' + __import__('json').dumps([tool['name'] for tool in gateway.describe()]))");
  const names = JSON.parse(/CALLABLES=(\[[^\n]*\])/.exec(catalogResult.text)[1]);
  const scenarios = {
    space_status: () => invoke("space_status", {}, worker, "assert isinstance(value['sessions'], list)"),
    session_list: () => invoke("session_list", {}, worker, "assert isinstance(value, list)"),
    session_send: async () => {
      const peer = (await host.createSession({ target: "local" })).session;
      await invoke("session_send", { to: peer.sessionId, message: "Return shape message", expectReply: false });
      await idle(peer.sessionId);
    },
    ask: () => invoke("ask", { questions: [{ id: "shape", question: "Choose a fixture value", options: [{ label: "native" }, { label: "text" }], recommended: 0 }] }, worker, "assert isinstance(value, str) and 'native' in value"),
    memory: () => invoke("memory", { target: "memory", action: "add", content: "Gateway values regression observes native Python return values." }),
    plugin_config: () => invoke("plugin_config", { action: "set", provider: "python-values", file: join(home, "plugin.json"), sections: [] }),
    skill_manage: () => invoke("skill_manage", { action: "create", name: "python-values", scope: "global", description: "Return value regression", whenToUse: "Checking Python results", evidence: "This real Gateway/Jupyter fixture checks structured tool returns.", procedure: ["Inspect native return values"], pitfalls: [], verification: [] }),
    skill_read: async () => {
      const result = await host.nativeAction(worker, { sessionId: worker, requestId: "reload-skill", action: "reload" });
      assert.equal(result.status, "completed");
      await invoke("skill_read", { path: join(home, "skills/python-values/SKILL.md") });
    },
    terminal_textsend: () => invoke("terminal_textsend", { name: "pyvalues", text: "printf terminal-value", yield_s: 1 }, worker, "assert isinstance(value, dict) and 'output' in value"),
    terminal_list: () => invoke("terminal_list", {}, worker, "assert isinstance(value, dict) and isinstance(value['terminals'], list)\nassert any(t['name'] == 'pyvalues' and t['owner'] == 'model' and isinstance(t['label'], str) and t['integration'] == 'ready' for t in value['terminals'])"),
    terminal_keysend: () => invoke("terminal_keysend", { name: "pyvalues", keys: "C-c", yield_s: 0.1 }),
    terminal_read: () => invoke("terminal_read", { name: "pyvalues", yield_s: 0.1 }),
    terminal_set: () => invoke("terminal_set", { name: "pyvalues", quiet_notify: true }, worker, "assert value == {'name': 'pyvalues', 'quiet_notify': True}"),
    terminal_close: () => invoke("terminal_close", { name: "pyvalues" }),
    write: () => invoke("write", { path: "native-write.txt", content: "before\n" }),
    read: () => invoke("read", { path: "native-write.txt" }),
    edit: () => invoke("edit", { path: "native-write.txt", oldText: "before", newText: "after" }),
    bash: () => invoke("bash", { command: "printf native-shell" }),
    grep: () => invoke("grep", { pattern: "needle", path: "native.txt" }),
    find: () => invoke("find", { pattern: "native*.txt", path: "." }),
    ls: () => invoke("ls", { path: "." }),
    session_spawn: () => spawn("return-child"),
    session_manage: async () => {
      await host.setSessionRoot({ sessionId: worker });
      await invoke("session_manage", { action: "project", session: host.state(worker).sessionId, project: "Python values" });
      await invoke("session_manage", { action: "project", session: child("return-child").sessionId, project: "Python values" });
      await spawn("transfer-child");
      await idle(child("transfer-child").sessionId);
      await invoke("session_manage", { action: "transfer", child: child("transfer-child").sessionId, to: child("return-child").sessionId });
      await invoke("session_manage", { action: "accept", child: child("transfer-child").sessionId }, child("return-child").sessionId);
      await invoke("session_manage", { action: "supervisor", session: child("return-child").sessionId });
      await invoke("session_manage", { action: "destroy", child: child("transfer-child").sessionId }, child("return-child").sessionId);
    },
    session_result: async () => {
      await idle(child("return-child").sessionId);
      await invoke("session_result", { summary: "Native Python value", artifacts: [], output: { answer: 42 } }, child("return-child").sessionId);
      await idle(worker);
      assert.equal(child("return-child").derivation.phase, "delivered", "Python result submission is receipt-delivered without an acknowledgment callback");
    },
  };
  // Discover from the public live catalog, not a hand-maintained list of production tools.
  // A newly added callable must supply a success scenario rather than silently escaping the guard.
  for (const name of names) assert(name in scenarios, `Missing return-value scenario for ${name}`);
  for (const [name, scenario] of Object.entries(scenarios)) {
    if (names.includes(name)) await scenario();
  }
  assert.deepEqual([...covered].sort(), [...names].sort(), "Every live gateway callable returned a checked Python value");
  await run(worker, "from prk_tool import host\nassert isinstance(host.call('session_list'), list)\nassert isinstance(gateway.session_list(), list)\ntry:\n    gateway.session_send(to='missing', message='must fail')\nexcept RuntimeError:\n    pass\nelse:\n    raise AssertionError('tool failure returned as data')");
  return [...covered].sort();
}
