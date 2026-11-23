import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";

test("project archive requires a path-safe project identity and explicit confirmation", () => {
  const request = (method, params) => validateRequest({ v: 1, id: 1, method, params });
  assert.equal(request("archiveProjectPreview", { projectId: "project-a" }).params.projectId, "project-a");
  assert.equal(request("archiveProject", { projectId: "project-a", confirm: true }).params.confirm, true);
  for (const params of [{ projectId: "../a", confirm: true }, { projectId: "project-a" }, { projectId: "project-a", confirm: false }, { projectId: "project-a", confirm: true, sessionId: "other" }]) {
    assert.throws(() => request("archiveProject", params));
  }
  assert.throws(() => request("archiveProjectPreview", { projectId: "project-a", confirm: true }));
});
