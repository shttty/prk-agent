import assert from "node:assert/strict";
import { join } from "node:path";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";

export async function checkArchiveTree({ host, faux, page, noOverflow, evidence }) {
  // Seed real SDK-owned archive trees for grouping, filtering and visual evidence.
  const treeMain = (await host.createSession({ target: "history-target", label: "Archive coordination" })).session.sessionId;
  host.assignProject(treeMain, { id: "archive-project", name: "Archive project" });
  faux.setResponses(Array.from({ length: 6 }, () => async (context) => {
    const last = context.messages.at(-1);
    return last?.role === "user" && JSON.stringify(last).includes("ARCHIVE_TREE_SEED")
      ? fauxAssistantMessage(fauxToolCall("session_spawn", { context: "Complete the assigned child task and retain its explicit lifecycle responsibility.", tasks: [{ task: "Archive child evidence", label: "Archive child", lifecycle: "persistent", target: "history-target", thinkingLevel: "off" }] }), { stopReason: "toolUse" })
      : fauxAssistantMessage("Archive fixture completed");
  }));
  const seed = await host.session(treeMain).submit({ requestId: "archive-tree-seed", message: "ARCHIVE_TREE_SEED" });
  assert.equal((await seed.completion).status, "completed");
  const child = host.workbench().sessions.find((node) => node.derivation?.owner === treeMain);
  assert(child, "Real session_spawn creates an owned child");
  const deadline = Date.now() + 15_000;
  while (host.session(child.sessionId).getSnapshot().operation) {
    assert(Date.now() < deadline, "Derived fixture finishes");
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  const otherMain = (await host.createSession({ target: "history-target", label: "Archive independent" })).session.sessionId;
  const archiveWorker = (await host.createSession({ target: "history-target", label: "Archive analysis" })).session.sessionId;
  host.assignProject(archiveWorker, { id: "archive-analysis", name: "Analysis project" });
  for (const name of [treeMain, otherMain, archiveWorker]) await host.archiveSession(name, { confirm: true });
  // Desktop and phone, light and dark: the archive view groups, filters and shows where each session sat.
  for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-mantine-color-scheme") !== theme) await page.locator("#theme-toggle").click();
      if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
      await page.locator("#open-settings").click();
      await page.locator("#open-archive").click();
      const dialog = page.locator("#settings-archive");
      await dialog.locator(`[data-archived="${child.sessionId}"][data-archive-owner="${treeMain}"][data-archive-target="history-target"][data-archive-project="archive-project"]`).waitFor();
      assert.equal(await dialog.locator("[data-archive-group]").count(), 3);
      await noOverflow(page);
      await page.screenshot({ path: join(evidence, `${device}-${theme}-archive-list.png`), animations: "disabled" });
      if (device === "desktop" && theme === "light") {
        await dialog.locator("#archive-filter-text").fill(child.sessionId);
        assert.equal(await dialog.locator("[data-archive-group]").count(), 1, "Member match retains the whole tree");
        for (const [query, count] of [["HISTORY INSTANCE", 3], ["Archive project", 1], ["Archive independent", 1]]) {
          await dialog.locator("#archive-filter-text").fill(query);
          assert.equal(await dialog.locator("[data-archive-group]").count(), count, "Filter matches instance, project and session labels case-insensitively");
        }
        await dialog.locator("#archive-filter-text").fill("no such archive fixture");
        await dialog.locator('[data-state="no-match"]').waitFor();
        await dialog.locator("#archive-filter-text").fill("");
      }
      await dialog.locator('#archive-view-switch input[value="projects"] + label').click();
      await dialog.locator('[data-archive-section="archive-project"]').waitFor();
      await dialog.locator('[data-archive-section="archive-analysis"]').waitFor();
      await page.screenshot({ path: join(evidence, `${device}-${theme}-archive-projects.png`), animations: "disabled" });
      await page.locator("#close-settings").click();
      await dialog.waitFor({ state: "hidden" });
    }
  }
  for (const name of [treeMain, otherMain, archiveWorker]) await host.purgeArchive(name, { confirm: true });
  await page.setViewportSize({ width: 1280, height: 900 });
}
