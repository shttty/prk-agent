import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { stringify } from "smol-toml";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";

// Run separately for localhost and office. PRK_HOME is a disposable config home;
// PI_TEST_ARTIFACT_HOME may point at the prepared, pinned-only verify-home.
const mode = process.argv[2];
assert(["localhost", "office"].includes(mode), "Specify localhost or office");
const authorized = join(tmpdir(), "uvenv-1");
const home = process.env.PRK_HOME;
const root = process.env.PI_TEST_TARGET_ROOT;
assert(home && isAbsolute(home) && home === resolve(home) && home.startsWith(`${authorized}/`), "Supply absolute isolated PRK_HOME under uvenv-1");
assert(root && isAbsolute(root) && root === resolve(root), "Supply absolute PI_TEST_TARGET_ROOT");
const command = mode === "office" ? process.env.PI_TEST_SSH : "ssh -T -oBatchMode=yes -oConnectTimeout=10 localhost";
assert(command, "PI_TEST_SSH required for office");
const remote = (script) => {
  const result = spawnSync("/bin/sh", ["-c", command], { input: `set -eu\n${script}\n`, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${script}\n${result.stderr}`);
  return result.stdout.trim();
};
const targetHome = remote('printf "%s" "$HOME"');
assert(root.startsWith(`${targetHome}/.cache/prk-uvenv-test-`) || (mode === "localhost" && root.startsWith(`${authorized}/`)), "Target root must be an owned acceptance directory");
const cwd = process.env.PI_TEST_TARGET_CWD ?? (mode === "localhost" ? join(home, "workspace") : undefined);
assert(cwd && isAbsolute(cwd) && cwd === resolve(cwd), "Supply absolute PI_TEST_TARGET_CWD for office");
assert(mode === "office" ? cwd.startsWith(`${targetHome}/tmp/uvenv-`) : cwd.startsWith(`${home}/`), "cwd must be an owned acceptance directory");
const artifactHome = process.env.PI_TEST_ARTIFACT_HOME;
if (artifactHome) assert(isAbsolute(artifactHome) && artifactHome === resolve(artifactHome) && artifactHome.startsWith(`${authorized}/`));
await mkdir(home, { recursive: true });
assert((await readdir(home)).every((name) => name === "assets"), "PRK_HOME must contain only prepared assets, not existing operator/test config");
if (!(await access(join(home, "assets")).then(() => true, () => false))) {
  assert(artifactHome, "Provide pinned assets in PRK_HOME/assets or PI_TEST_ARTIFACT_HOME");
  await cp(join(artifactHome, "assets"), join(home, "assets"), { recursive: true, force: false, errorOnExist: true });
}
const previous = Object.fromEntries(["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"].map((key) => [key, process.env[key]]));
const evidence = (value) => { const line = JSON.stringify({ mode, ...value }); console.log(line); appendFileSync(join(home, "managed-python.jsonl"), `${line}\n`); };
let host, createdRoot = false, createdCwd = false;
try {
  remote(`mkdir ${quoteShell(root)}`); createdRoot = true;
  remote(`mkdir -p ${quoteShell(resolve(cwd, ".."))}; mkdir ${quoteShell(cwd)}`); createdCwd = true;
  process.env.HOME = join(home, "gateway-user");
  await mkdir(process.env.HOME);
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  await prepareNativeToolArtifacts(home);
  await writeFile(join(agentDir, "settings.json"), "{}\n", { flag: "wx" });
  await writeFile(join(home, "config.toml"), stringify({ targetCacheRoot: root, memory: { review: false }, monitor: { enabled: false },
    session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true, workerTools: "direct", localTools: false,
      capabilities: { "lazy:tool:terminal_textsend": false, "lazy:tool:terminal_list": false } } }), { flag: "wx" });
  await writeFile(join(home, "instances.toml"), "instances = []\n", { flag: "wx", mode: 0o600 });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "managed-python-proof", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 120 }, () => (context) => {
    const last = context.messages.at(-1);
    const text = typeof last?.content === "string" ? last.content : (last?.content ?? []).filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
    if (last?.role !== "user" || !text.startsWith("UVENV_TOOL ")) return fauxAssistantMessage("Controlled result observed.");
    const { name, args } = JSON.parse(text.slice(11));
    return fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });
  }));
  host = await createGatewayHost({ cwd: home, home, model: "managed-python-proof/controlled", thinkingLevel: "off" },
    { runtimeDependencies: { cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", autoCompaction: false, autoRetry: false } });
  const deploy = async (target, action, joinPending = false) => {
    const done = Promise.withResolvers(), progress = [];
    const unsubscribe = host.subscribeSessions((event) => {
      if (event.type !== "target_environment_changed" || event.target !== target) return;
      const snapshot = event.details.environment;
      progress.push(snapshot); evidence({ environment: snapshot });
      if (["ready", "failed"].includes(snapshot.status)) done.resolve(snapshot);
    });
    const timer = setTimeout(() => done.reject(new Error(`P6 timed out: ${target}`)), 240000);
    try {
      await action();
      if (joinPending) {
        const running = host.getTargetEnvironment({ target });
        assert(["checking", "transferring"].includes(running.status), "addTarget starts P6 without Python configured");
        assert.deepEqual(host.deployTargetEnvironment({ target }), running, "another intent joins the same P6 job");
      }
      const ready = await done.promise;
      assert.equal(ready.status, "ready", JSON.stringify(ready));
      assert.equal(ready.percent, 100); assert.equal(ready.bytesPerSecond, 0);
      assert.equal(ready.transferredBytes, ready.totalBytes);
      assert(progress.every((item, i) => !i || (item.streamId === progress[0].streamId && item.revision > progress[i - 1].revision)));
      assert(progress.filter(({ status }) => status !== "ready").every(({ percent }) => percent < 100));
      return { ready, progress };
    } finally { clearTimeout(timer); unsubscribe(); }
  };
  const invoke = async (sessionId, name, args) => {
    const admission = await host.session(sessionId).submit({ requestId: randomUUID(), message: `UVENV_TOOL ${JSON.stringify({ name, args })}` });
    assert.equal(admission.accepted, true, JSON.stringify(admission));
    const completed = await admission.completion;
    assert.equal(completed.status, "completed", JSON.stringify(completed));
    const projected = host.session(sessionId).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === name);
    assert(projected, `Real SDK did not execute ${name}`);
    const result = projected.outputPreview ? host.toolContent(sessionId, projected.toolCallId).result : projected;
    const text = result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
    assert(!result.isError, text); evidence({ sessionId, tool: name, text }); return text;
  };
  const kernel = (sessionId, code) => invoke(sessionId, "kernel_code", { code, title: "Managed Python acceptance" });
  const terminal = async (sessionId, text) => {
    const value = JSON.parse(await invoke(sessionId, "terminal_textsend", { name: "managed-proof", text, yield_s: 120, timeout_s: 150 }));
    assert.equal(value.status, "done", JSON.stringify(value)); return value;
  };
  const configured = `managed-${mode}`, missing = `no-mirror-${mode}`, explicit = `explicit-${mode}`;
  const index = process.env.PI_TEST_PYTHON_INDEX_URL ?? "https://pypi.org/simple";
  const add = (name, fields = {}) => host.addTarget({ target: { id: name, label: name, cwd, sshCommand: command, ...fields } });
  const cold = await deploy(configured, () => add(configured, { pythonIndexUrl: index }), true);
  assert(cold.ready.totalBytes > 0 && cold.progress.some(({ bytesPerSecond }) => bytesPerSecond > 0));
  assert(cold.progress.some(({ status }) => status === "checking") && cold.progress.some(({ status }) => status === "transferring"));
  assert.equal(host.getTarget(configured).python, undefined, "Managed interpreter is not persisted as explicit Python");
  assert.match(await readFile(join(home, "instances.toml"), "utf8"), /pythonIndexUrl/);
  const expected = `${root}/venvs/${configured}/bin/python`;
  const environmentValue = "dict(executable=sys.executable, venv=os.environ.get('VIRTUAL_ENV'), path=os.environ.get('PATH'), index=os.environ.get('UV_INDEX_URL'))";
  const identity = `import json, os, shutil, sys\nassert sys.executable == ${JSON.stringify(expected)}, sys.executable\nassert sys.prefix != sys.base_prefix\nassert os.environ['VIRTUAL_ENV'] == sys.prefix == ${JSON.stringify(`${root}/venvs/${configured}`)}\nassert shutil.which('python') == sys.executable\nassert os.environ['UV_INDEX_URL'] == ${JSON.stringify(index)}\nprint('UVENV_IDENTITY=' + json.dumps(${environmentValue}))`;
  const first = (await host.createSession({ target: configured })).session.sessionId;
  const initial = await kernel(first, `${identity}\nimport importlib.util\nassert importlib.util.find_spec('idna') is None, 'Cold venv must actually need the package install'`);
  const kernelEnvironment = JSON.parse(/UVENV_IDENTITY=(\{[^\n]+\})/.exec(initial)[1]);
  const terminalIdentity = `import json, os, sys; value=${environmentValue}; assert value == json.loads(${JSON.stringify(JSON.stringify(kernelEnvironment))}), value; print('MODEL_TERMINAL_IDENTITY=' + json.dumps(value))`;
  const installed = await terminal(first, `printf 'UV_INDEX_URL=%s\\nUV_BINARY=%s\\n' "$UV_INDEX_URL" "$(command -v uv)"; python -c ${quoteShell(terminalIdentity)} && uv -v pip install --no-cache idna==3.10`);
  assert.equal(installed.exit_code, 0, installed.output); assert(installed.output.includes(index) && installed.output.includes(expected));
  assert(/^UV_BINARY=(.+)$/m.exec(installed.output)?.[1].trim().startsWith(`${root}/`), "Model terminal uses deployed uv, not a system uv");
  const listed = JSON.parse(await invoke(first, "terminal_list", {}));
  assert.equal(listed.terminals.find(({ name }) => name === "managed-proof")?.owner, "model");
  const second = (await host.createSession({ target: configured })).session.sessionId;
  for (const session of [first, second]) await kernel(session, `${identity}\nimport idna\nassert idna.__version__ == '3.10'\nassert idna.__file__.startswith(sys.prefix + '/')\nprint('PACKAGE_PERSISTED=' + idna.__file__)`);
  const warm = await deploy(configured, () => host.deployTargetEnvironment({ target: configured }));
  assert.equal(warm.ready.totalBytes, 0); assert.equal(warm.ready.transferredBytes, 0);
  await kernel(second, `${identity}\nfrom pathlib import Path\nassert Path(idna.__file__).is_file(), 'Repeated P6 must preserve installed packages'`);
  await deploy(missing, () => add(missing), true);
  const noMirror = (await host.createSession({ target: missing })).session.sessionId;
  await kernel(noMirror, "import os\nassert not os.environ.get('UV_INDEX_URL')\nassert os.environ['UV_OFFLINE'] == '1' and os.environ['UV_NO_INDEX'] == '1'\nprint('NO_MIRROR_POLICY=offline,no-index')");
  const rejected = await terminal(noMirror, 'printf "UV_POLICY=%s|%s|%s\\n" "$UV_INDEX_URL" "$UV_OFFLINE" "$UV_NO_INDEX"; uv -vv pip install --no-cache idna==3.10');
  assert.notEqual(rejected.exit_code, 0); assert.match(rejected.output, /No PyPI mirror configured\./);
  assert.match(rejected.output, /UV_POLICY=\|1\|1/); assert.doesNotMatch(rejected.output, /pypi\.org|files\.pythonhosted\.org|Sending request|HTTP request/i);
  const python = remote("command -v python3"); assert(isAbsolute(python));
  const signature = remote(`stat -Lc '%s:%Y:%i' ${quoteShell(python)}`);
  await deploy(explicit, () => add(explicit, { python }), true);
  const selected = (await host.createSession({ target: explicit })).session.sessionId;
  await kernel(selected, `import sys\nassert sys.executable == ${JSON.stringify(python)}, sys.executable\nprint('EXPLICIT_UNCHANGED=' + sys.executable)`);
  assert.equal(host.getTarget(explicit).python, python);
  assert.equal(remote(`stat -Lc '%s:%Y:%i' ${quoteShell(python)}; test ! -e ${quoteShell(`${root}/venvs/${explicit}`)}`), signature);
  evidence({ status: "PASS", configured, sessions: [first, second], executable: expected, package: "idna==3.10", packageInstallRoute: "controlled faux -> model terminal_textsend", warmBytes: 0, missingMirror: "rejected with UV_OFFLINE=1 and UV_NO_INDEX=1", explicitPython: python,
    bootstrapOfflineEvidence: "P6 stderr: [managed Python, UV_OFFLINE=1] and file:// Python mirror; retain combined stdout/stderr" });
} finally {
  try { await host?.close(); }
  finally {
    try { const paths = [createdRoot && root, createdCwd && cwd].filter(Boolean); if (paths.length) remote(`rm -rf -- ${paths.map(quoteShell).join(" ")}`); }
    finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  }
}
