import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";
import { createSessionRequest } from "../../../src/http/session-routes/lifecycle/parse-create-request.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../src/config/limits/limits-options.ts";

test("HTTP and socket creation accept project selection without weakening assignment", () => {
  const wire = (method, params) => validateRequest({ v: 1, id: 1, method, params });
  for (const project of [{ id: "project-one", name: "One" }, { name: "New" }]) {
    const body = { target: "fixture", project };
    assert.deepEqual(wire("createSession", body).params.project, project);
    assert.deepEqual(createSessionRequest(DEFAULT_LIMITS_OPTIONS, body).project, project);
  }
  assert.throws(() => wire("assignProject", { sessionId: "session-one", project: { name: "New" } }));
  for (const project of [null, {}, { name: "" }, { id: "..", name: "One" }, { name: "One", unexpected: true }, { name: "bad\nname" }]) {
    assert.throws(() => wire("createSession", { target: "fixture", project }));
    assert.throws(() => createSessionRequest(DEFAULT_LIMITS_OPTIONS, { target: "fixture", project }));
  }
});
