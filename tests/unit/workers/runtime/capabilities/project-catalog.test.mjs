import assert from "node:assert/strict";
import { test } from "node:test";
import { fileVersionsChanged } from "../../../../../src/sessions/runtime/resources/registration/have-file-versions-changed.ts";
import { registrationSettingsVersion } from "../../../../../src/sessions/runtime/resources/registration/format-settings-version.ts";

test("registration file versions detect edits, install and removal without switch state", () => {
  const loaded = new Map([["/plugin.mjs", "100:20"], ["/skill/SKILL.md", "101:30"]]);
  assert.equal(fileVersionsChanged(loaded, new Map(loaded)), false);
  for (const path of loaded.keys()) {
    const current = new Map(loaded);
    current.set(path, "102:40");
    assert.equal(fileVersionsChanged(loaded, current), true, path);
    current.delete(path);
    assert.equal(fileVersionsChanged(loaded, current), true, `${path} removed`);
  }
  assert.equal(fileVersionsChanged(loaded, new Map([...loaded, ["/new.mjs", "103:10"]])), true);
});

test("only SDK registration settings affect the resource version", () => {
  const initial = { packages: ["/plugin"], extensions: ["/extension.mjs"], skills: ["/skills"] };
  const version = registrationSettingsVersion(JSON.stringify(initial));
  assert.equal(registrationSettingsVersion(JSON.stringify({ ...initial, model: "other", thinkingLevel: "high", compaction: { enabled: false } })), version);
  assert.equal(registrationSettingsVersion(undefined), registrationSettingsVersion("{}"), "Creating settings without resources changes no registration");
  for (const key of ["packages", "extensions", "skills"]) {
    assert.notEqual(registrationSettingsVersion(JSON.stringify({ ...initial, [key]: [] })), version, key);
    const removed = { ...initial };
    delete removed[key];
    assert.notEqual(registrationSettingsVersion(JSON.stringify(removed)), version, `${key} removed`);
  }
});
