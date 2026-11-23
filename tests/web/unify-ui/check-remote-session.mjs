import assert from "node:assert/strict";
import { closeSessionDetails, openSessionDetails } from "../../fixtures/session-details.mjs";

export async function checkRemoteSession({ page, client, host, click, sidebar, selectedTarget, dialog, targetOption, create, remoteCwd, selectedMode, themes, shot, changeMode, label, declarations, send, completed, assertTools, unknownName, viewport, problems, phone }) {
        // Instance + still preselects its explicit target instead of the preferred local default.
        await sidebar();
        await click(page.locator('[data-action="create-session"][data-target="remote"]'));
        await selectedTarget("remote");
        await click(page.locator("#close-management-dialog"));
        await dialog.waitFor({ state: "hidden" });
        await sidebar();
        await click(page.locator("#create-session"));
        await selectedTarget("local-first");
        await click(dialog.locator("#create-session-target"));
        await click(targetOption("remote"));
        const remote = await create("remote", remoteCwd);
        await selectedMode(remote, "code");
        await themes(async (label) => {
        await openSessionDetails(page, remote.sessionId, { touch: phone });
        await page.locator("#chat-local-tools").waitFor();
        assert.equal(await page.locator('#chat-local-tools[data-local="false"]').count(), 1, "Remote sessions render the native-tools switch even on loopback URLs");
        await closeSessionDetails(page, { touch: phone });
        assert.equal((await client.call("nativeCapabilities", { sessionId: remote.sessionId })).target.current.localTools, false);
        await shot(page, `${label}-remote-no-local-tools`);
        });
        await changeMode(remote, "direct");
        const remoteMarker = `UNIFY_REMOTE_${label}`;
        const remoteFrom = declarations.length;
        await send(remote, `print(${JSON.stringify(remoteMarker)})`);
        for (const entry of await completed(remote, remoteMarker, remoteFrom)) assertTools(entry.tools, "direct");
        await page.reload();
        await page.locator("#composer").waitFor();
        await selectedMode(remote, "direct");
        await sidebar();
        await click(page.locator(`[data-session-id=${JSON.stringify(unknownName)}] .management-session-select`));
        const unknownTool = page.locator('[data-tool-name="unknown_fixture_tool"]');
        await unknownTool.waitFor({ state: "attached" });
        const turnDisclosure = page.locator('details:has([data-tool-name="unknown_fixture_tool"])');
        if (await turnDisclosure.getAttribute("open") === null) await click(turnDisclosure.locator(":scope > summary"));
        if (await unknownTool.getAttribute("open") === null) await click(unknownTool.locator(":scope > summary"));
        await unknownTool.locator('.pi-io[data-kind="generic"]').waitFor({ state: "visible" });
        await themes(async (label) => {
        const genericBlocks = unknownTool.locator('[data-kind="generic"] pre');
        assert.equal(await genericBlocks.count(), 2, "Generic history row has input and output blocks");
        assert.equal(await genericBlocks.nth(0).isVisible(), true, "Unknown tool input is visible");
        assert.equal(await genericBlocks.nth(1).isVisible(), true, "Unknown tool output is visible");
        await unknownTool.locator('[data-kind="generic"]').evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        for (const block of await genericBlocks.all()) {
          const bounds = await block.boundingBox();
          assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, "Generic input and output are fully within the screenshot viewport");
        }
        assert.equal(await unknownTool.locator(".pi-io").getAttribute("data-kind"), "generic", "Unknown tool record renders generically");
        assert.equal(host.history(unknownName).snapshot.messages.find((message) => message.role === "toolResult")?.toolName, "unknown_fixture_tool", "Native tool history is not rewritten");
        await shot(page, `${label}-unknown-tool-generic`);
        assert.deepEqual(problems, [], `${label}: zero pageerror`);
        console.log(`PASS ${label}: real local/remote creation, local-first defaults, instance +, quiet/live tool-mode, effective SDK declarations and reload`);
        });
}
