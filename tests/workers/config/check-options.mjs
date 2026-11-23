import assert from "node:assert/strict";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { validTarget } from "../../../src/gateway/wire/instance-parameters/validate-instance-params.ts";

export function checkConfigOptions(defaults) {
  assert.deepEqual(defaults.instances, []);
  for (const value of [null, [], { bad: false }, { "not-a-module": {} }]) assert.throws(() => parsePrkConfig({ kernelTools: value }), /kernelTools/);
  assert.equal(defaults.session.inboxMaxMessages, 32);
  assert.equal(defaults.session.inboxMaxChars, 131072);
  assert.equal(defaults.session.maxMessageChars, 16384);
  assert.equal(defaults.session.rememberedNoReplyMax, 4096);
  assert.equal(defaults.kernel.executionTimeoutMs, undefined);
  assert.equal(defaults.kernel.asyncExecution, true);
  assert.deepEqual(defaults.kernel.reminderLadderMs, [60000, 300000, 900000, 1800000]);
  const instance = { id: "local", label: "Local", local: true, cwd: "/owned" };
  const configured = parsePrkConfig({ kernel: { asyncExecution: false, reminderLadderMs: [2147483647], executionTimeoutMs: 123 } }, {
    instances: [instance, { ...instance, id: "zero", label: "Zero", executionTimeoutMs: 0, kernel: { executionTimeoutMs: 456 } }],
  });
  assert.equal(configured.kernel.asyncExecution, false);
  assert.deepEqual(configured.kernel.reminderLadderMs, [2147483647]);
  assert.equal(configured.instances[0].kernel.kernelOptions.executionTimeoutMs, 123);
  assert.equal(configured.instances[1].kernel.kernelOptions.executionTimeoutMs, 456);
  assert.equal(configured.instances[1].kernel.executionTimeoutMs, 0);
  assert.equal(parsePrkConfig({ kernel: { executionTimeoutMs: 0 } }, { instances: [instance] }).instances[0].kernel.kernelOptions.executionTimeoutMs, 0);
  assert.equal(parsePrkConfig({}, { instances: [{ ...instance, kernel: { executionTimeoutMs: 0 } }] }).instances[0].kernel.kernelOptions.executionTimeoutMs, 0);
  assert(!("asyncExecution" in configured.instances[0].kernel.kernelOptions));
  assert(!("reminderLadderMs" in configured.instances[0].kernel.kernelOptions));
  for (const [key, invalid] of Object.entries({
    asyncExecution: [0, 1, "true", null, [], {}],
    reminderLadderMs: [null, 1, [], [0], [-1], [1.5], [2147483648], [1, 1], [2, 1], ["1"], [null], Array(1)],
    executionTimeoutMs: [-1, 1.5, 2147483648, "0", false, null],
    startTimeoutMs: [0], interruptTimeoutMs: [0], closeTimeoutMs: [0],
  })) {
    for (const value of invalid) assert.throws(() => parsePrkConfig({ kernel: { [key]: value } }), new RegExp(`kernel\\.${key}`));
  }
  for (const kernel of [{ asyncExecution: false }, { reminderLadderMs: [1] }]) {
    assert.throws(() => parsePrkConfig({}, { instances: [{ ...instance, kernel }] }), /unsupported field/);
    assert.equal(validTarget({ ...instance, kernel }, true, defaults.limits), false);
    assert.equal(validTarget({ ...instance, kernel }, false, defaults.limits), false);
  }
  assert.equal(validTarget({ ...instance, executionTimeoutMs: 0, kernel: { executionTimeoutMs: 0 } }, true, defaults.limits), true);
  for (const executionTimeoutMs of [-1, 1.5, 2147483648, "0", false, null]) {
    assert.throws(() => parsePrkConfig({}, { instances: [{ ...instance, executionTimeoutMs }] }), /execution timeout/);
    assert.equal(validTarget({ ...instance, executionTimeoutMs }, false, defaults.limits), false);
  }
  assert.deepEqual(defaults.targetConnection, { startTimeoutMs: 15000, requestTimeoutMs: 10000 });
  assert.deepEqual(defaults.learning, { autoTools: true, autoSkills: true });
  assert.deepEqual(parsePrkConfig({ learning: { autoTools: false } }).learning, { autoTools: false, autoSkills: true });
  assert.deepEqual(parsePrkConfig({ learning: { autoSkills: false } }).learning, { autoTools: true, autoSkills: false });
  for (const field of ["autoTools", "autoSkills"]) {
    for (const value of [null, 0, 1, "false", [], {}]) {
      assert.throws(() => parsePrkConfig({ learning: { [field]: value } }), new RegExp(`learning\\.${field}.*boolean`));
    }
  }
  assert.equal(parsePrkConfig({ targetConnection: { startTimeoutMs: 200 } }).targetConnection.startTimeoutMs, 200);
  const override = parsePrkConfig({ session: { idleTimeoutMs: 1200 }, http: { port: 0, streamTimeoutMs: 0 }, limits: { labelChars: 12 } });
  assert.equal(override.session.idleTimeoutMs, 1200);
  assert.equal(override.session.maxMessageChars, 16384);
  assert.equal(override.http.port, 0);
  assert.equal(parsePrkConfig({ http: { host: "203.0.113.10" } }).http.host, "203.0.113.10", "Configuration accepts arbitrary Web listener hosts");
  assert.equal(override.limits.labelChars, 12);
  assert.equal(defaults.session.askTimeoutMs, 0, "ask never times out by default");
  assert.equal(parsePrkConfig({ session: { askTimeoutMs: 0 } }).session.askTimeoutMs, 0);
  assert.equal(parsePrkConfig({ session: { askTimeoutMs: 60000 } }).session.askTimeoutMs, 60000);
  assert.equal(defaults.session.workerTools, "code");
  const daily = parsePrkConfig({ session: { workerTools: "direct" } });
  assert.equal(daily.session.workerTools, "direct");
  assert.equal(defaults.session.localTools, false);
  for (const localTools of [false, true]) {
    assert.equal(parsePrkConfig({ session: { localTools } }).session.localTools, localTools);
  }
  for (const localTools of [null, 0, 1, "false", "true", [], {}]) {
    assert.throws(() => parsePrkConfig({ session: { localTools } }), /session\.localTools.*boolean/);
  }
  assert.deepEqual(parsePrkConfig({ extensions: { allow: { packages: ["pkg"], tools: ["tool"] }, deny: { packages: [], tools: ["blocked"] } } }).extensions,
    { allow: { packages: ["pkg"], tools: ["tool"] }, deny: { packages: [], tools: ["blocked"] } });
  assert.equal(defaults.terminal.quietNotifyDefault, false);
  assert.equal(defaults.terminal.modelHistoryFile, "~/.bash_history.prk-model");
  assert.equal(parsePrkConfig({ terminal: { modelHistoryFile: "~/custom history" } }).terminal.modelHistoryFile, "~/custom history");
  for (const modelHistoryFile of ["", "bad\npath", "bad\rpath", "bad\0path", null, 1, false, [], {}]) {
    assert.throws(() => parsePrkConfig({ terminal: { modelHistoryFile } }), /terminal\.modelHistoryFile/);
  }
  for (const quietNotifyDefault of [false, true]) {
    assert.equal(parsePrkConfig({ terminal: { quietNotifyDefault } }).terminal.quietNotifyDefault, quietNotifyDefault);
  }
  for (const quietNotifyDefault of [null, 0, 1, "false", "true", [], {}]) {
    assert.throws(() => parsePrkConfig({ terminal: { quietNotifyDefault } }), /terminal\.quietNotifyDefault.*boolean/);
  }
  assert.deepEqual(defaults.monitor, {
    enabled: true, slowIntervalMs: 30000, fastIntervalMs: 5000, focusLeaseMs: 30000,
    historyWindowMs: 900000, customTimeoutMs: 5000, customMaxOutputBytes: 65536,
    memoryAlertPercent: 90, refreshDebounceMs: 300,
  });
  assert.equal(parsePrkConfig({ monitor: { memoryAlertPercent: 100, fastIntervalMs: 1000, enabled: false } }).monitor.fastIntervalMs, 1000);
  assert.deepEqual(defaults.codemode, { binChunkBytes: 1048576 });
  assert.equal(defaults.targetCacheRoot, "~/.cache/prk");
  assert.deepEqual(defaults.artifacts, { maxUploadBytes: 209715200 });
  assert.equal(defaults.gateway.systemdUnit, "");
  assert.equal(parsePrkConfig({ gateway: { systemdUnit: "prk-gateway.service", restartTimeoutMs: 5000 } }).gateway.systemdUnit, "prk-gateway.service");
  assert.deepEqual(defaults.remoteHost, { runtime: "bun", memoryMax: 1073741824, memorySwapMax: 0, abortTimeoutMs: 5000, nodeArgs: ["--optimize-for-size"], bunArgs: ["--smol"] });
  assert.deepEqual(parsePrkConfig({ remoteHost: { memoryMax: 268435456, abortTimeoutMs: 250 } }).remoteHost,
    { runtime: "bun", memoryMax: 268435456, memorySwapMax: 0, abortTimeoutMs: 250, nodeArgs: ["--optimize-for-size"], bunArgs: ["--smol"] });
  assert.equal(parsePrkConfig({ remoteHost: { memorySwapMax: 1048576 } }).remoteHost.memorySwapMax, 1048576);
  for (const remoteHost of [null, [], { unknown: 1 }, { memoryMax: 0 }, { memoryMax: "1G" },
    { memoryMax: 1.5 }, { memoryMax: Number.MAX_SAFE_INTEGER + 1 }, { memorySwapMax: -1 },
    { memorySwapMax: "0" }, { memorySwapMax: true }, { abortTimeoutMs: 0 }, { abortTimeoutMs: 2147483648 }]) {
    assert.throws(() => parsePrkConfig({ remoteHost }), /remoteHost/);
  }
  for (const nodeArgs of [[], ["--max-old-space-size=512", "--optimize-for-size"]]) {
    assert.deepEqual(parsePrkConfig({ remoteHost: { nodeArgs } }).remoteHost.nodeArgs, nodeArgs);
  }
  for (const nodeArgs of [null, "--optimize-for-size", 1, false, {}, [null], [1], ["--optimize-for-size", false], ["--title=bad\0arg"]]) {
    assert.throws(() => parsePrkConfig({ remoteHost: { nodeArgs } }), /remoteHost\.nodeArgs/);
  }
  for (const runtime of ["bun", "node"]) assert.equal(parsePrkConfig({ remoteHost: { runtime } }).remoteHost.runtime, runtime);
  for (const runtime of [null, "deno", "", 1, true]) assert.throws(() => parsePrkConfig({ remoteHost: { runtime } }), /remoteHost\.runtime/);
  for (const bunArgs of [[], ["--smol"]]) assert.deepEqual(parsePrkConfig({ remoteHost: { bunArgs } }).remoteHost.bunArgs, bunArgs);
  for (const bunArgs of [null, "--smol", {}, [1], ["bad\0arg"]]) assert.throws(() => parsePrkConfig({ remoteHost: { bunArgs } }), /remoteHost\.bunArgs/);
}
