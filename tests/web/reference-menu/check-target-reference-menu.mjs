import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";

export async function checkTargetReferenceMenu(ctx) {
for (const phone of [false, true]) {
      const label = phone ? "phone" : "desktop";
      const context = await ctx.browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const problems = [];
      page.on("pageerror", (error) => problems.push(error.message));
      const sends = [];
      page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/send")) sends.push(request.postDataJSON()); });
      await page.goto(ctx.ui.url, { waitUntil: "domcontentloaded" });
      await page.locator("#app-shell").waitFor();
      if (phone) await page.locator("#open-sidebar").click();
      await page.locator(`[data-session-id=${JSON.stringify(ctx.sessionId)}]`).click();
      const composer = page.locator("#composer");
      await composer.waitFor();
      const list = page.locator("#native-reference-list");
      const option = (path) => list.locator(`[data-path=${JSON.stringify(ctx.targetPath(path))}]`);
      const value = () => composer.inputValue();
      const pick = async (path) => { if (phone) await option(path).tap(); else await option(path).click(); };
      const shot = async (name) => { await page.screenshot({ path: join(ctx.evidence, `${label}-${name}.png`) }); };

      // First screen is exactly cwd, on desktop and phone; the fixture directory's decoy folder is not a candidate.
      if (phone) await composer.tap(); else await composer.click();
      await composer.fill("@");
      await option("deep").waitFor();
      assert.deepEqual(await list.locator("[data-path]").evaluateAll((nodes) => nodes.map((node) => node.dataset.path).sort()), ["deep", "folder", "many"].map(ctx.targetPath));
      await shot("reference-cwd");

      if (phone) {
        // Phone: tap through two directory levels to a file.
        await composer.tap();
        await composer.fill("@");
        await pick("deep");
        assert.equal(await value(), "@deep/");
        await pick("deep/level1");
        await pick("deep/level1/level2");
        assert.equal(await value(), "@deep/level1/level2/");
        await shot("reference-levels");
        await pick("deep/level1/level2/leaf.txt");
        assert.equal(await value(), "@deep/level1/level2/leaf.txt ");
        await page.locator('[data-action="remove-reference"]').waitFor();
        assert.equal(await list.count(), 0, "phone: the menu closes after a file");
        assert.equal(sends.length, 0, "phone: picking never sends");
        await assertUniqueIds(page, "phone reference menu");
        assert.deepEqual(problems, [], "phone: page errors");
        await context.close();
        console.log("PASS phone: @ menu taps through two directory levels to a file reference");
        continue;
      }

      // Parent navigation remains relative in the composer; candidate paths are absolute.
      await composer.fill("@../");
      await option(".").waitFor();
      await option("../sibling.txt").waitFor();
      await shot("reference-parent");
      await option(".").click();
      assert.equal(await value(), "@../proj/");
      await option("deep").waitFor();
      await composer.fill("@");
      await option("folder").waitFor();

      // 2. Clicking a directory keeps "@dir/" (no trailing space), the menu open on that directory, and no Pi list.
      await pick("deep");
      assert.equal(await value(), "@deep/");
      await option("deep/level1").waitFor();
      await pick("deep/level1");
      assert.equal(await value(), "@deep/level1/");
      await pick("deep/level1/level2");
      assert.equal(await value(), "@deep/level1/level2/");
      await option("deep/level1/level2/leaf.txt").waitFor();
      await shot("reference-levels");
      await page.waitForTimeout(600); // Pi autocomplete is debounced 100 ms and then round-trips
      assert.equal(await page.locator("#extension-autocomplete-list").count(), 0, "Pi's path list never opens beside @");

      // 3. Typing "@folder/" by hand lists it.
      await composer.fill("@folder/");
      await option("folder/note.txt").waitFor();

      // 4. Keyboard: ↓ moves the highlight (aria-activedescendant follows), Tab enters a directory, Enter picks a file.
      await composer.fill("@");
      await option("folder").waitFor();
      const active = () => page.evaluate(() => {
        const id = document.querySelector("#composer")?.getAttribute("aria-activedescendant");
        const node = id ? document.getElementById(id) : null;
        return node ? { path: node.dataset.path, selected: node.getAttribute("aria-selected") } : null;
      });
      const first = await active();
      assert.equal(first?.selected, "true", "the first option starts highlighted");
      await composer.press("ArrowDown");
      const second = await active();
      assert.notEqual(second?.path, first.path, "ArrowDown moves the highlight");
      assert.equal(second.selected, "true");
      // Listings come in directory order, so walk at most once around the menu to reach "folder".
      const rows = await list.locator('[data-path]').count();
      for (let step = 0; step < rows && (await active())?.path !== ctx.targetPath("folder"); step++) await composer.press("ArrowDown");
      assert.equal((await active())?.path, ctx.targetPath("folder"));
      await composer.press("Tab");
      assert.equal(await value(), "@folder/");
      await option("folder/note.txt").waitFor();
      await page.waitForFunction(() => document.querySelector("#composer")?.getAttribute("aria-activedescendant"));
      await composer.press("Enter");
      assert.equal(await value(), "@folder/note.txt ", "Enter picks the highlighted file");
      await page.locator('[data-action="remove-reference"]').waitFor();
      assert.equal(sends.length, 0, "Enter picked, it did not send");

      // 5. Scroll follows the highlight in a long directory, and a pointer parked on the list does not steal it:
      //    rows sliding under a still pointer while the list scrolls are not a hover.
      await composer.fill("@many/");
      await option("many/f00.txt").waitFor();
      await list.locator('[data-path]').nth(2).hover();
      const start = Number((await composer.getAttribute("aria-activedescendant")).split("-").pop());
      assert.equal(start, 2, "moving the pointer onto a row highlights it");
      for (let step = 0; step < 25; step++) await composer.press("ArrowDown");
      const visible = await page.evaluate(() => {
        const id = document.querySelector("#composer")?.getAttribute("aria-activedescendant");
        const node = id && document.getElementById(id);
        const box = document.querySelector("#native-reference-list")?.getBoundingClientRect();
        const row = node?.getBoundingClientRect();
        return { id: node?.id, inView: Boolean(box && row && row.top >= box.top - 1 && row.bottom <= box.bottom + 1), scrolled: document.querySelector("#native-reference-list")?.scrollTop > 0 };
      });
      assert.deepEqual(visible, { id: "native-reference-option-27", inView: true, scrolled: true }, "the keyboard highlight is scrolled into view and stays put");

      // 6. While the menu is open Enter never sends: empty list and error both.
      await composer.fill("hello @nothing-here");
      await page.waitForFunction(() => document.querySelector("#native-reference-list")?.dataset.status === "empty");
      await composer.press("Enter");
      await page.waitForTimeout(400);
      assert.equal(sends.length, 0, "Enter with an empty @ menu does not send");
      assert.equal(await value(), "hello @nothing-here");

      // 7. A directory that does not exist: the reason shows in the menu; no banner, input kept, Enter still does not send.
      //    (There is no root boundary any more: /etc/ is an ordinary absolute target path.)
      await composer.fill("hello @/prk-reference-missing/");
      await list.locator('#native-reference-error[data-reason="not-found"]').waitFor();
      await shot("reference-not-found");
      assert.equal(await page.locator("#connection-banner").count(), 0, "no banner");
      assert.equal(await page.locator("#chat-error").count(), 0, "no chat error");
      await composer.press("Enter");
      await page.waitForTimeout(400);
      assert.equal(sends.length, 0, "Enter with an @ error does not send");
      assert.equal(await value(), "hello @/prk-reference-missing/");

      // 8. /abs steps down level by level; candidate paths stay absolute.
      await composer.fill(`@${ctx.cwd}/`);
      await pick("deep");
      assert.equal(await value(), `@${ctx.cwd}/deep/`);
      await pick("deep/level1");
      assert.equal(await value(), `@${ctx.cwd}/deep/level1/`);
      await option("deep/level1/level2").waitFor();
      await shot("reference-abs-levels");

      // 8b. ~ is not expanded: the menu says so, the input stays, Enter does not send.
      await composer.fill("hello @~/");
      await list.locator('#native-reference-error[data-reason="home-unsupported"]').waitFor();
      await shot("reference-home-unsupported");
      await composer.press("Enter");
      await page.waitForTimeout(400);
      assert.equal(sends.length, 0, "Enter with the ~ reason does not send");
      assert.equal(await value(), "hello @~/");

      // 9. Pi's own completion: a command still lists, CJK punctuation no longer pops the Gateway's directory.
      await composer.fill("/ref-pro");
      await page.locator("#extension-autocomplete-list").waitFor();
      await composer.fill("看看这个？");
      await page.waitForTimeout(600);
      assert.equal(await page.locator("#extension-autocomplete-list").count(), 0, "no Pi path list after CJK punctuation");

      // 10. Esc closes the menu; then Enter sends normally.
      await composer.fill("hello @nothing-here");
      await page.waitForFunction(() => document.querySelector("#native-reference-list")?.dataset.status === "empty");
      await composer.press("Escape");
      await list.waitFor({ state: "detached" });
      await composer.press("Enter");
      await page.waitForFunction(() => document.querySelector("#composer")?.value === "");
      assert.equal(sends.length, 1, "Enter after Esc sends");
      assert.equal(sends[0].message, "hello @nothing-here");
      assert.deepEqual(sends[0].references?.map((reference) => reference.path), [ctx.targetPath("folder/note.txt")], "the picked file rides along as its absolute target path, not its relative spelling");
      const deadline = Date.now() + 15_000;
      while (ctx.receivedInput === undefined) {
        assert.ok(Date.now() < deadline, "faux provider receives the browser send");
        await page.waitForTimeout(50);
      }
      assert.ok(ctx.receivedInput.includes(`path=${JSON.stringify(ctx.targetPath("folder/note.txt"))}]\nCWD_NOTE_62419\n\n[/target-file]`), "the model receives cwd file content selected using @folder/");
      assert.ok(!ctx.receivedInput.includes("ROOT_DECOY_73820"));
      await shot("reference-sent");

      await assertUniqueIds(page, "desktop reference menu");
      assert.deepEqual(problems, [], "desktop: page errors");
      await context.close();
      console.log("PASS desktop: @ lists cwd, ../ navigation, relative file reaches faux provider, keyboard/Enter guard, /abs, not-found and ~/ rules");
    }
}
