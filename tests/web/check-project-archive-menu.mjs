// Project group header: `+` and `…` menu in the project view; "archive all sessions of the project" runs through the
// real Gateway/HTTP/Vite stack, the sessions land in the archive page under their project, and the project's own
// files stay. Hooks only (ids, data-action/data-project, data-count/data-status), no UI copy.
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";
import { checkCreatePreselect } from "./project-archive/check-create-preselect.mjs";
import { checkCreateProjects } from "./project-archive/check-create-projects.mjs";
import { dialogClosed } from "./project-archive/dialog-closed.mjs";
import { dialogOpen } from "./project-archive/dialog-open.mjs";
import { openProjectView } from "./project-archive/open-project-view.mjs";
import { showSidebar } from "./project-archive/show-sidebar.mjs";

const DEVICES = [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]];
async function openArchivePreview(page, projectId, count) {
  await page.locator(`.management-group[data-group="${projectId}"]`).waitFor();
  await page.locator(`[data-action="project-menu"][data-project="${projectId}"]`).click();
  await page.locator(`[data-action="archive-project"][data-project="${projectId}"]`).click();
  await dialogOpen(page, "archive-project");
  const body = page.locator(`#management-dialog .management-archive-confirm[data-project="${projectId}"][data-status="ready"]`);
  await body.waitFor();
  assert.equal(await body.locator("[data-affected]").count(), count, "Preview lists every active session of the project once");
  return body;
}

async function archiveThroughMenu(page, { projectId, count, shot }) {
  await openArchivePreview(page, projectId, count);
  await shot();
  await page.locator("#confirm-archive-project").click();
  await dialogClosed(page);
}

// The second member's native SDK session file becomes a directory after the preview, so the SDK's own persistent write
// fails with EISDIR in the middle of the batch (real failure, nothing mocked). The file is restored afterwards.
async function sessionFile(root, sessionId) {
  for (const name of await readdir(root, { recursive: true })) {
    if (!name.endsWith(".jsonl")) continue;
    const header = (await readFile(join(root, name), "utf8").catch(() => "")).split("\n")[0];
    if (header && JSON.parse(header).id === sessionId) return join(root, name);
  }
  throw new Error(`native session file of ${sessionId} not found`);
}

async function archiveWithFailure(page, { root, evidence, projectId, ids }) {
  await openArchivePreview(page, projectId, ids.length);
  const path = await sessionFile(root, ids[1]);
  await rename(path, `${path}.saved`);
  await mkdir(path);
  try {
    await page.locator("#confirm-archive-project").click();
    const result = page.locator('#archive-project-result[data-status="failed"]');
    await result.waitFor();
    assert.equal(await result.getAttribute("data-archived-count"), "1");
    assert.equal(await result.getAttribute("data-unarchived-count"), "2");
    const listed = async (kind) => (await result.locator(`[data-outcome-list="${kind}"] [data-outcome-session]`).evaluateAll((nodes) => nodes.map((node) => node.dataset.outcomeSession))).sort();
    assert.deepEqual(await listed("archived"), [ids[0]]);
    assert.deepEqual(await listed("unarchived"), ids.slice(1).sort());
    assert((await result.locator(".mantine-Alert-message").first().textContent()).trim().length > 0, "The error reason is shown");
    assert.equal(await page.locator("#confirm-archive-project").count(), 0, "A failed batch cannot be confirmed again");
    await page.screenshot({ path: join(evidence, "desktop-project-archive-failure.png"), animations: "disabled" });
  } finally {
    await rm(path, { recursive: true, force: true });
    await rename(`${path}.saved`, path);
  }
  await page.locator('#management-dialog [data-action="cancel"]').click();
  await dialogClosed(page);
  await page.locator(`[data-session-id="${ids[0]}"]`).waitFor({ state: "detached" });
  for (const id of ids.slice(1)) await page.locator(`[data-session-id="${id}"]`).waitFor();
  // Closing and previewing again starts afresh with the sessions that are still active.
  await openArchivePreview(page, projectId, 2);
  await page.locator('#management-dialog [data-action="cancel"]').click();
  await dialogClosed(page);
}

async function assertArchivedUnderProject(page, projectId, sessionIds) {
  await showSidebar(page);
  await page.locator("#open-settings").click();
  await page.locator("#open-archive").click();
  const archive = page.locator("#settings-archive");
  await archive.locator('#archive-view-switch input[value="projects"] + label').click();
  const section = archive.locator(`[data-archive-section="${projectId}"]`);
  await section.waitFor();
  for (const sessionId of sessionIds) await section.locator(`[data-archived="${sessionId}"]`).waitFor();
  assert.equal(await section.locator("[data-archived]").count(), sessionIds.length, "Archive page finds exactly the archived sessions under the project");
  return archive;
}

await withRequestWorkbench(async ({ root, evidence, client, ui, page, settle, requests, createSession, errors }) => {
  const projects = {
    desktop: { id: "proj-desktop", name: "Archive desktop", sessions: [await createSession("Desktop one"), await createSession("Desktop two")] },
    phone: { id: "proj-phone", name: "Archive phone", sessions: [await createSession("Phone one")] },
  };
  const failing = { id: "proj-failing", name: "Archive failing", sessions: [await createSession("Failing one"), await createSession("Failing two"), await createSession("Failing three")] };
  const seeded = { id: "proj-created", name: "Created existing", sessions: [await createSession("Created seed")] };
  const loose = await createSession("Loose session");
  for (const { id, name, sessions } of [...Object.values(projects), failing, seeded]) {
    for (const sessionId of sessions) await client.request("assignProject", { sessionId, project: { id, name } });
    const directory = join(root, "memories", "projects", id);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "memory.md"), `notes of ${id}\n`);
  }

  await page.setViewportSize(DEVICES[0][1]);
  await page.goto(ui.url);
  await openProjectView(page);
  // Header hooks: a real project has `+` and `…`; the ungrouped group has `+` only.
  await page.locator(`.management-group[data-group="project:ungrouped"] [data-session-id="${loose}"]`).waitFor();
  await page.locator('[data-action="create-session"][data-project="project:ungrouped"]').waitFor();
  assert.equal(await page.locator('[data-action="project-menu"][data-project="project:ungrouped"]').count(), 0);
  await checkCreateProjects(page, { existing: seeded, newName: "Created brand new", requests });
  await archiveWithFailure(page, { root, evidence, projectId: failing.id, ids: failing.sessions });

  for (const [device, viewport] of DEVICES) {
    const { id, sessions } = projects[device];
    await page.setViewportSize(viewport);
    await settle();
    if (device === "phone") await openProjectView(page);
    await checkCreatePreselect(page, { device, evidence, project: projects[device] });
    await archiveThroughMenu(page, {
      projectId: id, count: sessions.length,
      shot: () => page.screenshot({ path: join(evidence, `${device}-project-archive-confirm.png`), animations: "disabled" }),
    });
    // Phone: the dialog closed the drawer; its kept-mounted list is only checked once the drawer is shown again.
    await showSidebar(page);
    for (const sessionId of sessions) await page.locator(`[data-session-id="${sessionId}"]`).waitFor({ state: "detached" });
    await page.locator(`.management-group[data-group="project:ungrouped"] [data-session-id="${loose}"]`).waitFor();
    await assertArchivedUnderProject(page, id, sessions);
    await page.screenshot({ path: join(evidence, `${device}-project-archive-list.png`), animations: "disabled" });
    await page.locator("#close-settings").click();
    await page.locator("#settings-archive").waitFor({ state: "hidden" });
    assert.equal(await readFile(join(root, "memories", "projects", id, "memory.md"), "utf8"), `notes of ${id}\n`, "Project files stay after archiving its sessions");
  }
  assert.deepEqual(errors, []);
  console.log("PASS project archive menu: header menu archives the project's sessions, archive page keeps them under the project, project files stay");
});
