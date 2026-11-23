import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkRemoteDialogs({ begin, prompt, host, name, settled, until, targetResult, identity, results, page, upgradeUi, sessionId, native, evidence, finish, transientDialog, events }) {
  // A cancelled dialog cannot answer the first dialog after the linked plugin directory changes and the host reloads.
  const old = await begin("confirm");
  const oldCard = await prompt("confirm");
  const oldId = await oldCard.getAttribute("data-prompt-id");
  const oldStreamId = host.state(name).streamId;
  await page.locator("#cancel-operation").click();
  await oldCard.waitFor({ state: "detached" });
  await settled(old, "cancelled");
  const oldTarget = await until(() => targetResult(old.args.token), Boolean, "target confirm settles after turn abort");
  identity(oldTarget, old);
  assert.equal(oldTarget.value, false);
  assert.equal(oldTarget.toolSignalAborted, true);
  results.push(oldTarget);
  // The package is a linked local directory; the next host generation packs its edited content (version 2.0.0).
  await upgradeUi();
  const reloaded = await native("reload", {});
  assert.equal(reloaded.httpStatus, 200);
  assert.equal(reloaded.body.status, "completed", JSON.stringify(reloaded.body));
  assert.equal(host.state(name).extensionUi.prompts.length, 0);
  assert.notEqual(host.state(name).streamId, oldStreamId, "Remote package reload replaces the SDK host stream rather than comparing revisions across hosts");
  assert.equal(host.state(name).sessionId, sessionId);
  const replacement = await begin("confirm");
  const newCard = await prompt("confirm");
  const newId = await newCard.getAttribute("data-prompt-id");
  const stale = await native("extension-ui", { operation: "dialog", id: oldId, value: true });
  assert.equal(stale.httpStatus, 200);
  assert.equal(stale.body.status, "unavailable", "an old response cannot answer the replacement runtime's active dialog");
  assert.notEqual(newId, oldId, "dialog IDs remain unique across replacement runtimes");
  assert.equal(host.state(name).extensionUi.prompts.some((item) => item.id === newId), true);
  assert.equal(host.state(name).operation?.operationId, replacement.operationId, "the replacement is still waiting for its own answer");
  assert.equal(await targetResult(replacement.args.token), undefined);
  await page.screenshot({ path: join(evidence, "remote-ui-confirm.png"), fullPage: true, animations: "disabled" });
  await newCard.locator('[data-action="submit"]').click();
  const replacementResult = await finish(replacement, true);
  assert.notEqual(replacementResult.pid, oldTarget.pid, "reload really replaced the target extension process");
  assert.equal(oldTarget.packageVersion, "1.0.0");
  assert.equal(replacementResult.packageVersion, "2.0.0");

  const data = await begin("data");
  await finish(data);
  const notification = host.state(name).extensionUi.notifications.find((item) => item.message === `REMOTE_NOTICE:${data.args.token}`);
  assert.ok(notification);
  const toast = page.locator(`[data-toast-id="${notification.id}"][data-type="warning"]`);
  await toast.waitFor({ state: "visible" });
  assert.equal(await toast.locator(".mantine-Notification-description").textContent(), `REMOTE_NOTICE:${data.args.token}`);
  await page.locator('[data-status-key="remote-ui"]').waitFor({ state: "visible" });
  assert.equal(await page.locator('[data-status-key="remote-ui"]').textContent(), `REMOTE_STATUS:${data.args.token}`);
  for (const [key, placement, text] of [
    ["remote-ui-above", "aboveEditor", `REMOTE_WIDGET_ABOVE:${data.args.token}\ntarget text widget`],
    ["remote-ui-below", "belowEditor", `REMOTE_WIDGET_BELOW:${data.args.token}`],
  ]) {
    const widget = page.locator(`[data-widget-key="${key}"][data-placement="${placement}"]`);
    await widget.waitFor({ state: "visible" });
    assert.equal(await widget.locator("pre").textContent(), text);
  }
  await page.waitForFunction((text) => document.querySelector("#composer")?.value === text, `REMOTE_EDITOR:${data.args.token}`);
  assert.equal(host.state(name).extensionUi.title, `REMOTE_TITLE:${data.args.token}`);
  await page.waitForFunction((text) => document.querySelector("#topbar-title")?.textContent === text, `REMOTE_TITLE:${data.args.token}`);
  await page.screenshot({ path: join(evidence, "remote-ui-data.png"), fullPage: true, animations: "disabled" });
  await finish(await begin("clear"));
  await page.locator('[data-status-key="remote-ui"]').waitFor({ state: "detached" });
  await page.locator('[data-widget-key="remote-ui-above"]').waitFor({ state: "detached" });
  await page.locator('[data-widget-key="remote-ui-below"]').waitFor({ state: "detached" });
  await page.waitForFunction(() => document.querySelector("#composer")?.value === "");
  const unsupported = await finish(await begin("unsupported"), undefined);
  assert.match(unsupported.themeError, /ui\.theme/);
  assert.equal(await page.locator('[data-widget-key="remote-ui-factory"], [data-prompt-kind="custom"]').count(), 0);

  for (const kind of ["select", "confirm", "input", "editor"]) {
    const answer = await begin(kind);
    const card = await prompt(kind);
    let expected;
    if (kind === "select") {
      expected = "remote-beta";
      await card.locator('[data-value="remote-beta"]').click();
    } else {
      expected = kind === "confirm" ? true : `REMOTE_ANSWER:${kind}\n${kind === "editor" ? "second line" : ""}`.trimEnd();
      if (kind === "input") await card.locator("input").fill(expected);
      if (kind === "editor") {
        assert.equal(await card.locator("textarea").inputValue(), `REMOTE_PREFILL:${answer.args.token}`);
        await card.locator("textarea").fill(expected);
      }
      await card.locator('[data-action="submit"]').click();
    }
    await finish(answer, expected);
    await card.waitFor({ state: "detached" });
    const cancelled = await begin(kind);
    const cancelCard = await prompt(kind);
    await cancelCard.locator('[data-action="cancel"]').click();
    await finish(cancelled, kind === "confirm" ? false : undefined);
    await cancelCard.waitFor({ state: "detached" });
  }
  for (const kind of ["select", "confirm", "input"]) {
    const expected = kind === "confirm" ? false : undefined;
    const { turn: timedOut, card: timeoutCard, id: timeoutId } = await transientDialog(kind, { timeoutMs: 1200 });
    await finish(timedOut, expected);
    await timeoutCard.waitFor({ state: "detached" });
    assert.equal((await native("extension-ui", { operation: "dialog", id: timeoutId, value: true })).body.status, "unavailable");
    const { turn: aborted, card: abortCard } = await transientDialog(kind, { abortAfterMs: 1200 });
    const abortedDetails = await finish(aborted, expected);
    assert.equal(abortedDetails.dialogSignalAborted, true);
    assert.equal(abortedDetails.toolSignalAborted, false, "dialog abort does not cancel its owning tool");
    await abortCard.waitFor({ state: "detached" });
    const alreadyAborted = await begin(kind, { preAborted: true });
    const preAbortedDetails = await finish(alreadyAborted, expected);
    assert.equal(preAbortedDetails.dialogSignalAborted, true);
    assert.equal(host.state(name).extensionUi.prompts.length, 0);
  }
  const editorAbort = await begin("editor");
  const editorCard = await prompt("editor");
  await page.locator("#cancel-operation").click();
  await editorCard.waitFor({ state: "detached" });
  await settled(editorAbort, "cancelled");
  const editorTarget = await until(() => targetResult(editorAbort.args.token), Boolean, "target editor settles after turn abort");
  identity(editorTarget, editorAbort);
  assert.equal(editorTarget.valueType, "undefined");
  assert.equal(editorTarget.toolSignalAborted, true);
  results.push(editorTarget);

  const logs = (await events()).filter((event) => event.t === "log" && event.stream === "stderr").map((event) => event.data).join("");
  assert.match(logs, /warn|unsupported|not supported|ignored/i, "unsupported RPC presentation APIs produce target warnings");
  for (const method of ["registerMessageRenderer", "registerEntryRenderer", "registerToolRenderer", "renderCall", "renderResult", "setWidget", "setFooter", "setHeader", "setEditorComponent", "custom", "ui.theme"]) {
    assert.ok(logs.includes(method), `warning identifies unsupported ${method}`);
  }
}
