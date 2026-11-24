import assert from "node:assert/strict";
import test from "node:test";
import { parseInstanceConfig } from "../../../src/config/execution-target/parse-instance-config.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";
import { composerMode } from "../../../web/chat/composer/composer-mode.js";
import { commandLine } from "../../../src/workspace/model-terminals/commands/command-line.ts";

test("instance routing identity is id; the legacy name and mixed form are rejected", () => {
  const fields = { local: true, label: "Workbench", cwd: "/work" };
  assert.equal(parseInstanceConfig([{ ...fields, id: "fixture" }])[0].kernel.target, "fixture");
  for (const target of [{ ...fields, name: "fixture" }, { ...fields, id: "fixture", name: "fixture" }]) {
    assert.throws(() => parseInstanceConfig([target]), /replace the removed name field with id/);
  }
});

test("an image alone is a draft and a valid send, but an empty message is neither", () => {
  const image = { name: "pixel.png", type: "image/png", size: 1, data: "AA==", source: "browser" };
  const input = { normalizedComposerText: "", candidateOptions: [], composerText: "", queue: "followUp" };
  const send = { v: 1, id: 1, method: "send", params: { sessionId: "s", requestId: "r", message: "" } };
  assert.equal(composerMode({ ...input, attachments: [] }).hasDraft, false);
  assert.throws(() => validateRequest(send), /invalid/i);
  assert.equal(composerMode({ ...input, attachments: [image] }).hasDraft, true);
  const valid = { ...send, params: { ...send.params, attachments: [image] } };
  assert.deepEqual(validateRequest(valid), valid);
});

test("model terminal uses the first nonempty command line without splitting Unicode", () => {
  assert.equal(commandLine("  \r\n   printf hello  \nprivate second line"), "printf hello");
  assert.equal(commandLine(`${"x".repeat(158)}🙂tail`), `${"x".repeat(158)}…`);
});
