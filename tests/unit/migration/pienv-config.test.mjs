import assert from "node:assert/strict";
import { test } from "node:test";
import { convertConfig } from "../../../scripts/pienv-migration/convert-config.mjs";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";

test("cutover validates and retires old limits, preserving the command input budget", () => {
  const source = { limits: { urlChars: 4000, tokenChars: 20, kernelNameChars: 30 } };
  const instances = { instances: [{ id: "local", label: "Local", local: true, cwd: "/workspace", url: "http://localhost/", token: "owned", defaultKernelName: "prk-python" }] };
  const converted = convertConfig(source, instances);
  assert.deepEqual({ ...converted.config.limits }, { sshCommandChars: 4000 });
  assert.equal(converted.parsed.limits.sshCommandChars, 4000);
  assert.equal(source.limits.tokenChars, 20);
  assert.deepEqual(convertConfig(converted.config, converted.instances).config, converted.config);
  for (const key of ["urlChars", "tokenChars", "kernelNameChars"]) {
    assert.throws(() => parsePrkConfig({ limits: { [key]: 10 } }), /unsupported/);
    assert.throws(() => convertConfig({ limits: { [key]: 0 } }, instances), /Invalid legacy limits/);
  }
  assert.throws(() => convertConfig({ limits: { urlChars: 5 } }, instances), /Invalid legacy instance URL/);
  assert.throws(() => convertConfig({ limits: { tokenChars: 2 } }, instances), /Invalid legacy instance token/);
  assert.throws(() => convertConfig({ limits: { kernelNameChars: 2 } }, instances), /Invalid legacy default kernelspec/);
  assert.throws(() => convertConfig({ limits: { urlChars: 20, sshCommandChars: 21 } }, instances), /Conflicting/);
});
