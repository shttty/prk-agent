import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkRename({ host, home, create, projectSection, events }) {
  const project = { id: "project-rename", name: "旧名" };
  const current = await create(project);
  const archived = await create(project);
  await host.archiveSession(archived, { confirm: true });
  const namesake = await create({ name: "已占用" });
  await host.archiveSession(namesake, { confirm: true });
  const sessionDir = join(home, "sessions");
  async function sessionFile(id) {
    for (const name of await readdir(sessionDir)) {
      const file = join(sessionDir, name);
      const header = (await readFile(file, "utf8")).split("\n", 1)[0];
      if (JSON.parse(header).id === id) return file;
    }
    throw new Error(`Session ${id} was not persisted`);
  }
  const files = await Promise.all([current, archived].map(sessionFile));
  const before = await Promise.all(files.map((file) => readFile(file, "utf8")));
  for (const invalid of ["已占用", "   "]) {
    assert.throws(() => host.renameProject(project.id, invalid), { code: "INVALID_REQUEST" });
  }
  assert.deepEqual(await Promise.all(files.map((file) => readFile(file, "utf8"))), before);
  assert.deepEqual(host.renameProject(project.id, " 新名 "), { ok: true });
  for (const [index, file] of files.entries()) {
    const after = await readFile(file, "utf8");
    assert.ok(after.startsWith(before[index]), "Existing JSONL bytes must be preserved");
    const entry = JSON.parse(after.slice(before[index].length));
    assert.equal(entry.customType, "gateway-session-project");
    assert.deepEqual(entry.data.project, { id: project.id, name: "新名" });
  }
  const registry = JSON.parse(await readFile(join(home, "memories", "projects", project.id, "project.json"), "utf8"));
  assert.equal(registry.name, "新名");
  assert.equal(events.findLast((event) => event.type === "session_project_renamed")?.details?.session?.requiresReload, true);
  assert.equal(events.findLast((event) => event.type === "archive_group_updated")?.details?.archiveGroup?.sessions[0].projectName, "新名");
  assert.match(await projectSection(current), /当前项目：旧名/u);
}
