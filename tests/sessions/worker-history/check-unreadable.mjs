import assert from "node:assert/strict";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createSessionHistory } from "../../../src/sessions/history/assemble-history.ts";

export async function checkUnreadableHistory({ cwd, directory, exclusiveSession, healthySessionId }) {
  const check = async (file, manager, pattern) => {
    const history = await createSessionHistory({ cwd, directory });
    const issue = history.readIssues().find((entry) => entry.sessionFile === file);
    assert(issue, "Unreadable history remains explicitly represented");
    assert.equal(issue.sessionId, manager.getSessionId());
    assert.match(issue.reason, pattern);
    assert.throws(() => history.get(manager.getSessionId()), pattern, "Unreadable data fails closed for the addressed session");
    assert(history.get(healthySessionId), "An unrelated healthy session remains readable");
  };
  const malformedFile = join(directory, "malformed.jsonl");
  const malformed = await exclusiveSession(malformedFile, cwd, directory, "Malformed", { version: 4, target: 42, cwd: "/srv/malformed" });
  const malformedBytes = await readFile(malformedFile, "utf8");
  await check(malformedFile, malformed, /binding/i);
  assert.equal(await readFile(malformedFile, "utf8"), malformedBytes, "malformed file is not rewritten");
  await unlink(malformedFile);

  const malformedProjectFile = join(directory, "malformed-project.jsonl");
  const malformedProject = await exclusiveSession(malformedProjectFile, cwd, directory, "Malformed project", {
    version: 4, target: "target-project", cwd: "/srv/malformed-project",
  });
  malformedProject.appendCustomEntry("gateway-session-project", { version: 1, project: { id: "analysis", name: "\n" } });
  const malformedProjectBytes = await readFile(malformedProjectFile, "utf8");
  await check(malformedProjectFile, malformedProject, /project metadata|project membership/i);
  assert.equal(await readFile(malformedProjectFile, "utf8"), malformedProjectBytes, "malformed project metadata is not rewritten");
  await unlink(malformedProjectFile);

  const history = await createSessionHistory({ cwd, directory });
  const duplicateSource = history.create("target-duplicate", "Duplicate source", "/srv/duplicate");
  const duplicateFile = join(directory, "duplicate.jsonl");
  await writeFile(duplicateFile, await readFile(duplicateSource.getSessionFile(), "utf8"));
  await check(duplicateFile, duplicateSource, /duplicate/i);
  const duplicateHistory = await createSessionHistory({ cwd, directory });
  assert.throws(() => duplicateHistory.get(duplicateSource.getSessionId()), /duplicate/i, "Both files sharing one native identity are quarantined");
  assert.equal(duplicateHistory.readIssues().filter((issue) => issue.sessionId === duplicateSource.getSessionId()).length, 2);
  await unlink(duplicateFile);

  const strayFile = join(directory, "stray-cwd.jsonl");
  const storedBinding = { version: 4, target: "target-stray" };
  for (const [label, extra] of [["relative", { cwd: "proj" }], ["dot", { cwd: "." }], ["missing", {}]]) {
    const stray = await exclusiveSession(strayFile, cwd, directory, "Stray cwd", { ...storedBinding, ...extra });
    const bytes = await readFile(strayFile, "utf8");
    await check(strayFile, stray, /binding cwd|binding data/i);
    assert.equal(await readFile(strayFile, "utf8"), bytes, `${label}: file is not rewritten`);
    await unlink(strayFile);
  }
  for (const retargetCwd of ["proj", undefined]) {
    const stray = await exclusiveSession(strayFile, cwd, directory, "Stray retarget", { ...storedBinding, cwd: "/srv/stray" });
    stray.appendCustomEntry("gateway-session-retarget", { version: 2, sessionId: stray.getSessionId(), target: "target-stray", ...(retargetCwd === undefined ? {} : { cwd: retargetCwd }) });
    await check(strayFile, stray, /retarget|cwd/i);
    await unlink(strayFile);
  }
}
