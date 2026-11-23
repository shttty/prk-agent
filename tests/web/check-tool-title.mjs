// Real isolated Gateway/backend/Vite/Chromium and owned Python; only the model provider is controlled.
// Call titles head kernel_code and native read rows, name the background task, survive a reload; calls without one keep the old header.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fauxAssistantMessage, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createKernelAsyncFixture, text, until } from "../fixtures/kernel-async-setting/create-fixture.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) assert(process.env[name], `${name} is required`);
const evidence = process.env.PI_TEST_TOOL_TITLE_EVIDENCE || process.env.PI_TEST_WEB_EVIDENCE;
const shots = evidence ? resolve(evidence) : await mkdtemp(join(tmpdir(), "prk-title-shots-"));
await mkdir(shots, { recursive: true });
const KERNEL_TITLE = "统计夹具里的行数";
const READ_TITLE = "读取夹具笔记";

await withTargetFixture(async (target) => {
  const note = join(target.tempRoot, "title-note.txt");
  await writeFile(note, "TITLE_NOTE_BODY\n");
  const gate = join(target.tempRoot, "title-go");
  const declared = [];
  const calls = {
    TITLED_KERNEL: () => fauxToolCall("kernel_code", { title: KERNEL_TITLE, code: `import os, time\nwhile not os.path.exists(${JSON.stringify(gate)}): time.sleep(0.05)\nprint('TITLED_KERNEL_DONE')`, yield_s: 0 }, { id: "titled-kernel" }),
    TITLED_READ: () => fauxToolCall("read", { title: READ_TITLE, path: note }, { id: "titled-read" }),
    UNTITLED: () => fauxToolCall("kernel_code", { code: "print('UNTITLED_LINE')" }, { id: "untitled" }),
  };
  const f = await createKernelAsyncFixture({ ...target, session: { localTools: true }, respond: (context, _options, request) => {
    if (request.last?.role === "toolResult") return fauxAssistantMessage("FIXTURE_TOOL_OBSERVED");
    declared.push(getCurrentTools(context.messages));
    const call = calls[text(request.last)];
    return call ? fauxAssistantMessage(call(), { stopReason: "toolUse" }) : fauxAssistantMessage("FIXTURE_PLAIN");
  } });
  const { page, sessionId } = f;
  const row = (id) => page.locator(`details.pi-tool[data-tool-key$=${JSON.stringify(id)}]`);
  const select = async () => {
    await page.locator(`[data-session-id=${JSON.stringify(sessionId)}] .management-session-select`).click();
    await page.locator("#composer").waitFor({ state: "visible" });
  };
  const send = async (message) => {
    await page.locator("#composer").fill(message);
    await page.locator("#send-message").click();
  };
  const titles = async () => {
    for (const [id, title] of [["titled-kernel", KERNEL_TITLE], ["titled-read", READ_TITLE]]) {
      assert.equal(await row(id).locator(":scope > summary .pi-tool-call-title").textContent(), title, `${id}: the call title heads the row`);
    }
    assert.equal(await row("untitled").locator(":scope > summary .pi-tool-call-title").count(), 0);
    assert.equal(await row("untitled").locator(":scope > summary .pi-tool-args").textContent(), "print('UNTITLED_LINE')", "a call without a title keeps the code headline");
  };

  await page.goto(f.uiUrl);
  await select();
  await page.locator("#open-settings").click();
  await page.locator('[data-settings-section="general"]').click();
  await page.locator('#setting-tool-title[data-status="ready"]').waitFor();
  assert.equal(await page.locator("#setting-tool-title").isChecked(), true, "call titles are on by default");
  await page.locator("#close-settings").click();

  await send("TITLED_KERNEL");
  await page.locator(`#background-tasks li[data-task-name=${JSON.stringify(KERNEL_TITLE)}], #background-tasks .pi-background-task-name[title=${JSON.stringify(KERNEL_TITLE)}]`).first().waitFor();
  await f.idle();
  await writeFile(gate, "go");
  await until(async () => !(await f.state()).kernel?.activeCells?.length, "kernel cell finishes");
  await send("TITLED_READ");
  await until(() => f.results.get("titled-read"), "native read result");
  assert.match(text(f.results.get("titled-read")), /TITLE_NOTE_BODY/);
  await f.idle();
  await send("UNTITLED");
  await until(() => f.results.get("untitled"), "kernel result without a title");
  await f.idle();
  const leaves = (schema) => (schema.anyOf ?? schema.oneOf)?.flatMap(leaves) ?? [schema];
  for (const tool of declared[0]) assert(leaves(tool.parameters).every((branch) => branch.required?.[0] === "title"), `${tool.name} requires the title`);

  await row("untitled").waitFor({ state: "attached" });
  await titles();
  await page.reload();
  await select();
  await row("untitled").waitFor({ state: "attached" });
  await titles();

  const files = {};
  for (const [name, id] of [["title-kernel-row", "titled-kernel"], ["title-read-row", "titled-read"]]) {
    const path = join(shots, `${name}.png`);
    for (const fold of await row(id).locator("xpath=ancestor::details").all()) {
      if (!await fold.evaluate((node) => node.open)) await fold.locator(":scope > summary").click();
    }
    await row(id).scrollIntoViewIfNeeded();
    await row(id).screenshot({ path });
    const file = await stat(path);
    assert(file.isFile() && file.size > 0, `${name}: screenshot exists`);
    files[name] = { path, bytes: file.size };
  }
  assert.deepEqual(f.errors, []);
  console.log(JSON.stringify({ fixture: "real Gateway/backend/Vite/Chromium/owned Python", callTitles: true, reloadKeepsTitles: true, untitledFallback: true, screenshots: files }));
});
