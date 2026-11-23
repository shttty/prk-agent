import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkSkillCatalog({ browser, ui, evidence, live, settled, showProvider }) {
    // Mock catalog: target project directories, Gateway global skills, shadowed marker and shared-library scope.
    {
      const { installSkillsMock, openSessionSkills, skillsMock } = await import("../skills-mock.mjs");
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);
      const { scopeRequests } = await installSkillsMock(page);
      await page.goto(ui.url);
      await openSessionSkills(page); await settled(page);
      const [longGroup, ancestorGroup, sharedGroup] = skillsMock.groups;
      assert.deepEqual(await page.locator("#skills-sources [data-provider]").evaluateAll((nodes) => nodes.map((node) => node.dataset.provider)), skillsMock.groups.map((group) => group.id), "providers keep catalog.groups order");
      assert.equal(await page.locator('#skills-sources [data-provider="group:skills:instance"]').count(), 0, "the session panel has no target-home skill source");
      if (evidence) await page.screenshot({ path: join(evidence, "skills-project-global-desktop-light.png"), animations: "disabled" });
      // Hover a truncated label: a tooltip with the full backend label appears; moving away closes it.
      const hoverTooltip = async (id, label) => {
        await page.locator(`#skills-sources [data-provider="${id}"] .capability-provider-name`).hover();
        await page.locator('[role="tooltip"]', { hasText: label }).waitFor();
        assert.equal(await page.locator('[role="tooltip"]').first().textContent(), label, `${id}: tooltip carries the full label`);
        await page.mouse.move(1, 1);
        await page.locator('[role="tooltip"]').waitFor({ state: "detached" });
      };
      for (const group of skillsMock.groups.filter((item) => item.id.startsWith("group:skills:dir:"))) {
        const name = page.locator(`#skills-sources [data-provider="${group.id}"] .capability-provider-name`);
        assert.equal(await name.getAttribute("title"), null, "no native title next to the tooltip");
        assert.equal(await name.textContent(), group.name, "label text is the backend label");
        const fits = await name.evaluate((node) => {
          const box = node.getBoundingClientRect(), part = (key) => node.querySelector(`[data-part="${key}"]`);
          return { machineInside: part("machine").getBoundingClientRect().right <= box.right + 0.5, tailWhole: part("tail").getBoundingClientRect().right <= box.right + 0.5, headCut: part("head").scrollWidth > part("head").clientWidth };
        });
        assert.equal(fits.machineInside && fits.tailWhole, true, `${group.id}: machine and parent directory stay visible`);
        if (group === longGroup) assert.equal(fits.headCut, true, "the long path is cut in the middle");
      }
      {
        const fixed = skillsMock.groups.find((item) => item.id === "group:skills:global");
        const name = page.locator(`#skills-sources [data-provider="${fixed.id}"] .capability-provider-name`);
        assert.equal(await name.getAttribute("title"), null, "no native title next to the tooltip");
        assert.equal(await name.textContent(), fixed.name, "label text is the backend label");
        // The canonical Gateway label is short; constrain its head to exercise the fixed-label overflow branch.
        await name.evaluate((node) => { node.style.maxWidth = `${node.querySelector('[data-part="machine"]').getBoundingClientRect().width + 8}px`; });
        const fits = await name.evaluate((node) => {
          const box = node.getBoundingClientRect(), part = (key) => node.querySelector(`[data-part="${key}"]`);
          const machine = part("machine"), head = part("head");
          return {
            machineWhole: machine.getBoundingClientRect().right <= box.right + 0.5 && machine.scrollWidth <= machine.clientWidth,
            headCut: head.scrollWidth > head.clientWidth,
            beforeCount: box.right <= node.nextElementSibling.getBoundingClientRect().left + 0.5,
          };
        });
        assert.deepEqual(fits, { machineWhole: true, headCut: true, beforeCount: true }, "fixed group: last segment whole, head ellipsized, no overlap with the count");
        await hoverTooltip(fixed.id, fixed.name);
        await name.evaluate((node) => node.style.removeProperty("max-width"));
      }
      await hoverTooltip(longGroup.id, longGroup.name);
      {
        const plain = page.locator(`#skills-sources [data-provider="${sharedGroup.id}"] .capability-provider-name`);
        await plain.hover(); await page.waitForTimeout(500);
        assert.equal(await page.locator('[role="tooltip"]').count(), 0, "a label that fits shows no tooltip");
        await page.mouse.move(1, 1);
      }
      await showProvider(page, ancestorGroup.id);
      const shadowedRow = page.locator(`${live} [data-capability="${skillsMock.shadowed.id}"]`);
      await shadowedRow.locator('[data-shadowed="true"]').waitFor();
      await showProvider(page, longGroup.id);
      assert.equal(await page.locator(`${live} [data-capability="${skillsMock.winner.id}"] [data-shadowed]`).count(), 0, "the winner carries no marker");
      await showProvider(page, ancestorGroup.id);
      await page.mouse.move(1, 1); await shadowedRow.locator(".capability-name").hover();
      const by = page.locator('#capability-peek[data-open="true"] [data-field="shadowed-by"]');
      await by.waitFor();
      assert.equal(await by.getAttribute("data-id"), skillsMock.winner.id);
      assert.equal((await by.textContent()).includes(skillsMock.winner.name) && (await by.textContent()).includes(longGroup.name), true, "the card names the winner and its group");

      await showProvider(page, sharedGroup.id);
      const sharedRow = page.locator("#skills-entry-panel-skill");
      const tag = (value) => sharedRow.locator(`.capability-scope[data-scope="${value}"]`);
      await tag("global").waitFor();
      await sharedRow.locator(".capability-copy").click();
      const select = page.locator('#capability-peek [data-field="scope"] select');
      assert.deepEqual(await select.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value)), ["global", "instance:alpha", "instance:beta", `project:${skillsMock.project.id}`]);
      await select.selectOption("instance:alpha");
      await tag("instance:alpha").waitFor();
      await select.selectOption(`project:${skillsMock.project.id}`);
      await tag(`project:${skillsMock.project.id}`).waitFor();
      assert.equal(await tag(`project:${skillsMock.project.id}`).textContent(), skillsMock.project.name, "a project scope shows the project name");
      assert.deepEqual(scopeRequests, [{ scope: "instance:alpha" }, { scope: `project:${skillsMock.project.id}` }]);
      await select.selectOption(skillsMock.failScope);
      await page.locator("#capabilities-error").waitFor();
      assert.equal(await select.inputValue(), `project:${skillsMock.project.id}`, "a refused scope change is not applied");
      assert.equal(await tag(`project:${skillsMock.project.id}`).count(), 1);
      assert.deepEqual(errors, [], "mock skills window: zero pageerror");
      await context.close();
      console.log("PASS skills window (mock): dynamic group labels, shadowed marker and winner, shared-library scope; pageerrors=0");
    }
}
