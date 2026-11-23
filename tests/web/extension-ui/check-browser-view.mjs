import assert from "node:assert/strict";
import { join } from "node:path";
import { checkBrowserAnsi } from "./check-browser-ansi.mjs";

export async function checkBrowserView({ browser, viewport, ui, main, host, faux, until, webTheme, fauxAssistantMessage, fauxToolCall }) {
  const page = await browser.newPage({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  await page.goto(ui.url);
  if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
  await page.locator(`[data-session-id="${main.session.sessionId}"] .management-session-select`).click();
  const invoke = async (value) => { await page.locator("#composer").fill(value); await page.locator("#send-message").click(); await page.waitForFunction(() => document.querySelector("#composer")?.value === ""); };
  const observedNotification = (message) => until(() => host.state(main.session.sessionId), (state) => state.extensionUi.notifications.some((item) => item.message === message), "browser callback");
  faux.setResponses([
    fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" }),
    fauxAssistantMessage(fauxToolCall("renderer_width", {}), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("renderer_plain", { note: "PLAIN_NOTE" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("renderer_multiline", {}), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("renderer_short", {}), { stopReason: "toolUse" }),
    fauxAssistantMessage(`BROWSER_RETRY_FINAL_${viewport.width}`),
  ]);
  await invoke(`BROWSER_RETRY_${viewport.width}`);
  await until(() => host.state(main.session.sessionId), (state) => state.state === "idle" && state.messages.at(-1)?.content?.some((part) => part.text === `BROWSER_RETRY_FINAL_${viewport.width}`), "browser retry final response");
  await page.locator('.topbar-status[data-status="idle"]').waitFor();
  assert.equal(await page.locator('.pi-operation-outcome.is-error').count(), 0, "successful retry does not show a failed operation");
  const retryRender = await page.evaluate(async ({ name }) => {
    const response = await fetch(`/api/sessions/${name}/native`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), action: "extension-ui", args: { operation: "render", width: 40, height: 30, clientId: "retry-browser" } }),
    });
    return response.json();
  }, { name: main.session.sessionId });
  assert.equal(retryRender.status, "completed", retryRender.message);
  await page.locator('.pi-message-assistant').filter({ hasText: `BROWSER_RETRY_FINAL_${viewport.width}` }).last().scrollIntoViewIfNeeded();
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `retry-success-${viewport.width}.png`), fullPage: true });
  await invoke("/probe input");
  await page.locator('[data-tool-name="renderer_throw"][data-extension-shell="self"]').waitFor({ state: "attached" });
  const prompt = page.locator('[data-prompt-kind="input"]');
  const inputValue = `BROWSER_INPUT_${viewport.width}`;
  await prompt.locator("input").fill(inputValue);
  await prompt.locator('[data-action="submit"]').click();
  await observedNotification(`input=${inputValue}`);
  await prompt.waitFor({ state: "hidden" });
  await until(() => host.state(main.session.sessionId), (state) => state.extensionUi.editor.text === "", "sent draft clears SDK editor view");
  await invoke("/probe confirm");
  await page.locator('[data-prompt-kind="confirm"] [data-action="submit"]').click();
  await page.locator('[data-prompt-kind="confirm"]').waitFor({ state: "hidden" });
  await invoke("/bridge-custom overlay");
  const custom = page.locator('.extension-ui-overlay [data-prompt-kind="custom"]');
  await custom.getByRole('textbox').fill(`CUSTOM_${viewport.width}`);
  await custom.locator('[data-action="submit"]').click();
  await observedNotification(`CUSTOM_RESULT=CUSTOM_${viewport.width}`);
  await custom.waitFor({ state: "hidden" });
  // A non-overlay custom is a card in the tray above the composer; the composer stays.
  await invoke("/probe custom_editor");
  const trayCard = page.locator('.pi-tray > [data-prompt-kind="custom"]');
  await trayCard.locator('[data-blocked="true"]').waitFor();
  await page.locator('#composer-form').waitFor({ state: "visible" });
  await page.locator('#composer').waitFor({ state: "visible" });
  const [cardBox, composerBox] = [await trayCard.boundingBox(), await page.locator('#composer-form').boundingBox()];
  assert.ok(cardBox.y + cardBox.height <= composerBox.y + 1, "the custom card sits above the composer, not over it");
  await trayCard.locator('[data-action="cancel"]').click();
  await trayCard.waitFor({ state: "hidden" });
  await invoke("/probe editor_component");
  await invoke("/probe editor_factory");
  await observedNotification("getEditorComponent=default");
  await page.locator('#composer-form').waitFor({ state: "visible" });
  await page.locator('#composer').waitFor({ state: "visible" });
  await invoke("/bridge-widget input");
  const widgetInput = page.locator('.extension-ui-widget').getByRole('textbox');
  await widgetInput.pressSequentially(`WIDGET_${viewport.width}`, { delay: 25 });
  await page.locator('.extension-ui-widget [data-action="submit"]').click();
  await observedNotification(`WIDGET_INPUT=WIDGET_${viewport.width}`);
  await invoke("/bridge-widget select");
  await page.locator('.extension-ui-widget').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Beta', exact: true }).click();
  await page.locator('.extension-ui-widget [data-action="submit"]').click();
  await observedNotification("WIDGET_SELECT=beta");
  await invoke("/bridge-widget submenu");
  await page.locator('[data-settings-submenu="mode"]').click();
  await page.locator('.extension-ui-widget').getByRole('textbox').fill(`SUBMENU_${viewport.width}`);
  await page.locator('.extension-ui-widget [data-action="submit"]').click();
  await observedNotification(`WIDGET_SUBMENU=mode:SUBMENU_${viewport.width}`);
  await page.locator('[data-settings-submenu="mode"]').waitFor();
  // Default-shell rows: the plugin renderCall is the collapsed header; tools without one keep name + args.
  for (const fold of await page.locator('.pi-turn-process').all()) if ((await fold.getAttribute('open')) === null) await fold.locator('summary').first().click();
  const row = (name) => page.locator(`.pi-tool[data-tool-name="${name}"]`).first();
  const header = (name) => row(name).locator('summary');
  for (const name of ["probe_default", "renderer_plain", "renderer_multiline", "renderer_short"]) await row(name).waitFor({ state: "visible" });
  // The render width follows the viewport, so a long call may wrap; compare whitespace-normalised text.
  const probeHeader = (await header("probe_default").textContent()).replace(/\s+/g, " ");
  assert.match(probeHeader, /probe_default call shell=default/, "renderCall output is the collapsed header");
  assert.ok(!probeHeader.includes("{"), "no raw argument string beside the renderCall header");
  assert.equal(await header("probe_default").locator(".pi-tool-args").count(), 0);
  assert.equal(await header("probe_default").locator(".tool-name").textContent(), "probe_default", "tool name stays readable for assistive tech");
  assert.equal(await header("renderer_plain").locator(".tool-name").textContent(), "renderer_plain");
  assert.match(await header("renderer_plain").locator(".pi-tool-args").textContent(), /^\{/, "tools without renderCall keep name + argument summary");
  const headerHeight = (name) => header(name).evaluate((element) => element.getBoundingClientRect().height);
  assert.equal(await headerHeight("renderer_multiline"), await headerHeight("probe_default"), "multi-line renderCall header stays one line");
  for (const name of ["renderer_short", "renderer_multiline"]) { assert.equal(await row(name).getAttribute("open"), null); await header(name).click(); }
  assert.match(await header("renderer_short").textContent(), /SHORT_CALL/);
  const shortBody = row("renderer_short").locator('.pi-tool-body');
  assert.equal(await shortBody.locator('.extension-tool-call').count(), 0, "single-line call is not repeated in the body");
  assert.doesNotMatch(await shortBody.textContent(), /SHORT_CALL/);
  assert.match(await shortBody.textContent(), /SHORT_RESULT/, "body keeps the result");
  const multilineBody = row("renderer_multiline").locator('.pi-tool-body');
  assert.match(await multilineBody.locator('.extension-tool-call').textContent(), /MULTI_FIRST[\s\S]*MULTI_SECOND/, "multi-line call opens in full at the top of the body");
  for (const detail of await page.locator('.pi-turn-process, .pi-tool').all()) if ((await detail.getAttribute('open')) === null) await detail.locator('summary').first().click();
  assert.equal(await page.locator('[data-tool-name="probe_self"] summary').count(), 0, "self renderer has no default shell");
  await page.locator('[data-extension-renderer-error]').first().waitFor({ state: "visible" });
  assert.match(await page.locator('[data-extension-renderer-error]').allInnerTexts().then((values) => values.join("\n")), /CALL_RENDERER_FAILURE|RESULT_RENDERER_FAILURE/);
  assert.match(await page.locator('.pi-message').allInnerTexts().then((values) => values.join("\n")), /RAW_MESSAGE_FALLBACK/);
  await page.locator('[data-extension-renderer-error^="message-"]').first().waitFor({ state: "visible" });
  assert.match(await page.locator('[data-extension-renderer-error^="message-"]').innerText(), /MESSAGE_RENDERER_FAILURE/);
  await checkBrowserAnsi({ invoke, page, until, host, main, viewport, webTheme });

  assert.ok(await page.locator('#composer').isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no phone/desktop horizontal overflow");
  await page.locator('#composer').fill(viewport.width > 600 ? '/probe-api-command e' : '/probe-api-command m');
  if (viewport.width > 600) {
    await page.locator('#extension-autocomplete-list').getByRole('option', { name: 'probe entry', exact: true }).waitFor();
    await page.locator('#composer').press('Tab');
    await page.waitForFunction(() => /^\/probe-api-command entry ?$/.test(document.querySelector('#composer')?.value || ''));
  } else {
    await page.locator('#extension-autocomplete-list').getByRole('option', { name: 'probe message', exact: true }).click();
    await page.waitForFunction(() => /^\/probe-api-command message ?$/.test(document.querySelector('#composer')?.value || ''));
  }
  await page.locator('#composer').fill('');
  faux.setResponses([
    fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error: first attempt" }),
    fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error: exhausted" }),
  ]);
  await invoke(`BROWSER_FAILED_${viewport.width}`);
  await until(() => host.state(main.session.sessionId), (state) => state.recentOperations.at(-1)?.status === "failed" && state.state === "idle", "exhausted browser retry fails only the operation");
  await page.locator('#messages .pi-operation-outcome[data-status="failed"]').waitFor();
  await page.locator('.topbar-status[data-status="idle"]').waitFor();
  assert.equal(await page.locator('#topbar-recover').count(), 0, "a failed operation needs no recovery control");
  assert.ok(await page.locator('#composer').isEnabled(), "the next input can be sent directly");
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `retry-exhausted-${viewport.width}.png`), fullPage: true });
  faux.setResponses([fauxAssistantMessage(`BROWSER_CONTINUED_${viewport.width}`)]);
  await invoke(`BROWSER_NEW_INPUT_${viewport.width}`);
  const continued = await until(() => host.state(main.session.sessionId), (state) => state.state === "idle" && state.messages.at(-1)?.content?.some((part) => part.text === `BROWSER_CONTINUED_${viewport.width}`), "explicit new input completes");
  assert.equal(continued.sessionId, main.session.sessionId);
  const userMessages = continued.messages.filter((message) => message.role === "user").map((message) => JSON.stringify(message.content));
  for (const marker of [`BROWSER_FAILED_${viewport.width}`, `BROWSER_NEW_INPUT_${viewport.width}`, `BROWSER_RETRY_${viewport.width}`]) {
    assert.equal(userMessages.filter((message) => message.includes(marker)).length, 1, "previous failed input/history is retained and not replayed");
  }
  await page.locator('.topbar-status[data-status="idle"]').waitFor();
  console.log(`PASS browser ${viewport.width}: exhausted retry fails the operation only (session idle, no recovery control); next input continues same history without replay`);
  await page.close();
}
