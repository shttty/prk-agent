import assert from "node:assert/strict";
import test from "node:test";
import { saveBlocker } from "../../../../web/instances/editor/save-blocker.js";
import { targetPayload } from "../../../../web/instances/editor/target-payload.js";

const draft = (patch = {}) => ({ id: "office", label: "Office", tags: "", cwd: "/home/u", local: false, sshCommand: "", python: "", pythonIndexUrl: "", ...patch });
const SSH = "SSHPASS=x sshpass -e ssh -T office";
const PY = "/usr/bin/python3.12";
const saved = { local: false, sshCommand: SSH, python: PY };

test("an instance missing its command or interpreter saves as pending after the structural checks only", () => {
  for (const form of [
    draft({ local: true }), // local without python
    draft({ sshCommand: SSH }), // remote with command, no python
    draft({ python: PY }), // remote missing only its command
    draft(), // remote missing both
  ]) assert.equal(saveBlocker(form), "", JSON.stringify(form));
  assert.equal(saveBlocker(draft({ label: " " })), "label");
  assert.equal(saveBlocker(draft({ cwd: "home/u" })), "cwd");
  assert.equal(saveBlocker(draft({ python: "python3" })), "python-path");
});

test("a new instance omits what is missing and sends the command exactly as typed", () => {
  assert.deepEqual(targetPayload(draft({ local: true, sshCommand: SSH }), null), { id: "office", label: "Office", tags: [], local: true, cwd: "/home/u" });
  assert.deepEqual(targetPayload(draft({ python: PY }), null), { id: "office", label: "Office", tags: [], local: false, cwd: "/home/u", python: PY });
  assert.equal(targetPayload(draft({ sshCommand: `  ${SSH} ` }), null).sshCommand, `  ${SSH} `);
  assert.equal("sshCommand" in targetPayload(draft({ sshCommand: "   " }), null), false);
});

test("an edit sends changes only: emptied fields clear with \"\", unchanged ones are kept by omission", () => {
  const unchanged = targetPayload(draft({ sshCommand: SSH, python: PY }), saved);
  assert.equal("sshCommand" in unchanged || "python" in unchanged, false);
  assert.equal(targetPayload(draft({ sshCommand: "", python: PY }), saved).sshCommand, "");
  assert.equal(targetPayload(draft({ sshCommand: SSH, python: " " }), saved).python, "");
  assert.equal(targetPayload(draft({ sshCommand: `${SSH} -p 2222`, python: PY }), saved).sshCommand, `${SSH} -p 2222`);
  const local = targetPayload(draft({ local: true, sshCommand: SSH, python: PY }), saved);
  assert.equal("sshCommand" in local, false, "local: true itself drops the stored command");
  assert.equal("python" in targetPayload(draft({ local: true }), { local: true }), false, "nothing stored, nothing to clear");
});

test("the PyPI mirror sends an override and clears it with an empty patch", () => {
  const pythonIndexUrl = "https://python.example/simple";
  assert.equal(targetPayload(draft({ pythonIndexUrl: ` ${pythonIndexUrl} ` }), null).pythonIndexUrl, pythonIndexUrl);
  assert.equal("pythonIndexUrl" in targetPayload(draft(), null), false);
  assert.equal("pythonIndexUrl" in targetPayload(draft({ pythonIndexUrl }), { ...saved, pythonIndexUrl }), false);
  assert.equal(targetPayload(draft({ pythonIndexUrl: "  " }), { ...saved, pythonIndexUrl }).pythonIndexUrl, "");
});
