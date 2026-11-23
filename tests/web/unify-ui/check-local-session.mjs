import assert from "node:assert/strict";
import { closeSessionDetails, openSessionDetails } from "../../fixtures/session-details.mjs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkLocalSession({ page, until, ui, host, unknownName, click, selectedTarget, dialog, themes, shot, create, localCwd, changeMode, changeLocalTools, reloadTools, label, declarations, send, completed, assertTools, checkMetaLayout, selectedMode, phone }) {
        await page.goto(ui.url, { waitUntil: "domcontentloaded" });
        await page.locator("#create-session-empty").waitFor();
        assert.deepEqual(host.workbench().sessions.map(({ sessionId }) => sessionId), [unknownName], "Only native persisted history exists before creation");
        await click(page.locator("#create-session-empty"));
        await selectedTarget("local-first");
        await click(dialog.locator("#create-session-target"));
        await themes(async (label, scheme) => {
          assert.equal(await page.locator("html").getAttribute("data-mantine-color-scheme"), scheme);
          await shot(page, `${label}-create-local-default`);
        });
        await page.locator("#create-session-target").press("Escape");
        const local = await create("local-first", localCwd);
        await openSessionDetails(page, local.sessionId, { touch: phone });
        await page.locator("#chat-local-tools").waitFor();
        assert.equal(await page.locator("#chat-local-tools").isChecked(), false, "New local session starts with native tools off");
        await closeSessionDetails(page, { touch: phone });
        for (const [mode, enabled] of [["code", false], ["code", true], ["direct", true], ["direct", false]]) {
          await changeMode(local, mode);
          await changeLocalTools(local, enabled);
          if (host.state(local.sessionId).requiresReload) await reloadTools(local);
          const marker = `UNIFY_${label}_${mode}_${enabled}`;
          const from = declarations.length;
          await send(local, `assert isinstance(gateway.session_list(), list)\nprint(${JSON.stringify(marker)})`);
          for (const entry of await completed(local, marker, from)) assertTools(entry.tools, mode, enabled);
        }
        await themes(async (label) => {
          await checkMetaLayout();
          await shot(page, `${label}-local-tools-off`);
        });

        // A real cell waits on an owned file, keeping the turn active until the visible picker finishes switching.
        await changeMode(local, "code");
        const release = join(localCwd, `${label}-release`);
        const liveMarker = `UNIFY_LIVE_${label}`;
        const liveFrom = declarations.length;
        await send(local, `from pathlib import Path\nimport time\nstop_at = time.monotonic() + 30\nwhile not Path(${JSON.stringify(release)}).exists():\n    if time.monotonic() > stop_at: raise TimeoutError('UI mode release missing')\n    time.sleep(0.01)\nprint(${JSON.stringify(liveMarker)})`);
        try {
          await page.locator("#cancel-operation").waitFor();
          await page.locator('[data-tool-name="kernel_code"][data-state="running"]').waitFor({ state: "attached" });
          assert.equal(host.state(local.sessionId).state, "running");
          assert.equal(await page.locator("#chat-tool-mode").isEnabled(), true, "Running does not disable tool-mode");
          await changeLocalTools(local, true);
          assert.equal(host.state(local.sessionId).state, "running", "The switch applied before the cell was released");
          assert.equal(host.state(local.sessionId).requiresReload, false, "Native switches take effect without reloading");
        } finally { await writeFile(release, "released"); }
        const liveCalls = await completed(local, liveMarker, liveFrom);
        assertTools(liveCalls[0].tools, "code");
        for (const entry of liveCalls.slice(1)) assertTools(entry.tools, "code", true);
        const appliedMarker = `UNIFY_APPLIED_${label}`;
        const appliedFrom = declarations.length;
        await send(local, `print(${JSON.stringify(appliedMarker)})`);
        for (const entry of await completed(local, appliedMarker, appliedFrom)) assertTools(entry.tools, "code", true);
        await themes(async (label) => {
          await checkMetaLayout();
          await shot(page, `${label}-local-tools-on`);
        });
        await page.reload();
        await page.locator("#composer").waitFor();
        await selectedMode(local, "code");
        await openSessionDetails(page, local.sessionId, { touch: phone });
        await until(async () => await page.locator("#chat-local-tools").isChecked(), "Reload preserves authoritative switch state");
        await closeSessionDetails(page, { touch: phone });
}
