import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkHostedControls({ main, worker, host, command, render, cc, send, action, until, marker, client }) {
  for (const created of [main, worker]) {
    const name = created.session.sessionId;
    assert.ok(host.nativeCapabilities(name).commands.some((entry) => entry.name === "probe" && entry.availability.enabled));
    assert.ok(host.nativeCapabilities(name).commands.some((entry) => entry.name === "bridge-widget"), JSON.stringify(host.nativeCapabilities(name).diagnostics));
    if (cc) assert.ok(host.nativeCapabilities(name).resources.some((entry) => entry.type === "extension" && entry.loaded && entry.name.includes("pi-cc-extensions")), "CC negative sample must actually load");
    assert.ok(host.state(name).extensionUi.status.some((entry) => entry.key === "pi-ui-probe" && entry.text.startsWith("loaded;")), "session_start UI is bound before runtime becomes available");
    await command(name, "status");
    assert.ok((await render(name)).status.some((entry) => entry.text.includes("status is set")));
    await command(name, "widget_above");
    assert.equal((await render(name)).widgets.find((widget) => widget.key === "probe-widget").placement, "aboveEditor");
    await command(name, "widget_below");
    assert.equal((await render(name)).widgets.find((widget) => widget.key === "probe-widget").placement, "belowEditor");
    await command(name, "widget_factory");
    assert.match(JSON.stringify((await render(name)).widgets), /widget factory/);
    await command(name, "widget-clear");
    assert.ok(host.state(name).extensionUi.status.some((entry) => entry.text === "widget factory disposed"));
    for (const kind of ["input", "select", "filtered", "settings"]) {
      const submitted = await send(name, `/bridge-widget ${kind}`);
      assert.equal((await submitted.completion).status, "completed");
      const node = (await render(name)).widgets.find((widget) => widget.key === "native-control").node;
      assert.equal(node.kind, kind === "filtered" ? "select" : kind);
      if (kind === "filtered") assert.deepEqual(node.options.map((item) => item.value), ["gamma"]);
      const value = kind === "input" ? "component value" : kind === "settings" ? { id: "mode", value: "second" } : kind === "filtered" ? "gamma" : "beta";
      assert.equal((await action(name, { operation: "component", componentOperation: "change", nodeId: node.id, clientId: "desktop", value })).status, "completed");
      if (kind !== "settings") await action(name, { operation: "component", componentOperation: "submit", nodeId: node.id, clientId: "desktop" });
      const expected = kind === "input" ? "WIDGET_INPUT=component value" : kind === "settings" ? "WIDGET_SETTING=mode:second" : kind === "filtered" ? "WIDGET_SELECT=gamma" : "WIDGET_SELECT=beta";
      assert.equal(host.state(name).extensionUi.notifications.at(-1).message, expected);
    }
    const descendants = (node) => node ? [node, ...(node.children || []).flatMap(descendants)] : [];
    for (const [caseName, kind, value, expected] of [
      ["tui-input", "input", "native-custom-input", "Input submit: native-custom-input"],
      ["tui-select-list", "select", "two", "SelectList: two"],
    ]) {
      const submitted = await send(name, `/probe ${caseName}`);
      const rendered = await until(() => render(name), (state) => state.prompts.some((prompt) => descendants(prompt.node).some((node) => node.kind === kind)), `custom ${caseName}`);
      const prompt = rendered.prompts.find((item) => item.kind === "custom");
      const node = descendants(prompt.node).find((item) => item.kind === kind);
      await action(name, { operation: "component", componentOperation: "change", nodeId: node.id, clientId: "desktop", value });
      if (kind !== "settings") await action(name, { operation: "component", componentOperation: "submit", nodeId: node.id, clientId: "desktop" });
      assert.ok(host.state(name).extensionUi.notifications.some((item) => item.message === expected));
      if (kind === "settings") await action(name, { operation: "custom-cancel", id: prompt.id });
      assert.equal((await submitted.completion).status, "completed");
      assert.equal((await action(name, { operation: "component", componentOperation: "change", nodeId: node.id, clientId: "desktop", value })).status, "unavailable", "Disposed custom component cannot be operated");
    }
    const settingsCustom = await send(name, "/bridge-custom settings");
    const settingsRender = await until(() => render(name), (state) => state.prompts.some((prompt) => prompt.node?.kind === "settings"), "theme-injected native SettingsList custom");
    const settingsNode = settingsRender.prompts.find((prompt) => prompt.kind === "custom").node;
    await action(name, { operation: "component", componentOperation: "change", nodeId: settingsNode.id, clientId: "desktop", value: { id: "mode", value: "second" } });
    assert.equal((await settingsCustom.completion).status, "completed");
    assert.ok(host.state(name).extensionUi.notifications.some((item) => item.message === "CUSTOM_RESULT=mode:second"));
    for (const caseName of ["tui-settings-list", "pi-extension-input", "pi-extension-selector"]) {
      const notificationIds = new Set(host.state(name).extensionUi.notifications.map((item) => item.id));
      const unsupported = await send(name, `/probe ${caseName}`);
      const completion = await unsupported.completion;
      assert.ok(host.state(name).extensionUi.notifications.some((item) => !notificationIds.has(item.id) && item.type === "error"));
      assert.equal(host.state(name).extensionUi.prompts.length, 0);
      console.log(`EXTENSION UI BLOCKED (${caseName}: Pi global theme dependency; completion=${completion.status}; no upstream mutation)`);
    }
    const customInput = await send(name, "/bridge-custom overlay");
    const customRender = await until(() => render(name), (state) => state.prompts.some((prompt) => prompt.node?.kind === "input"), "native keybindings custom overlay");
    const customPrompt = customRender.prompts.find((prompt) => prompt.kind === "custom");
    assert.equal(customPrompt.overlay.anchor, "top-right");
    assert.equal(customPrompt.focused, true);
    assert.equal(host.state(name).extensionUi.notifications.at(-1).message, "NATIVE_KEYS=ctrl+g:true");
    await action(name, { operation: "component", componentOperation: "submit", nodeId: customPrompt.node.id, clientId: "desktop", value: "final-submit-value" });
    assert.equal((await customInput.completion).status, "completed");
    assert.ok(host.state(name).extensionUi.notifications.some((item) => item.message === "CUSTOM_RESULT=final-submit-value"));
    assert.equal(host.state(name).extensionUi.status.find((item) => item.key === "custom-disposal-count")?.text, "1", "custom component is released exactly once, independently of consecutive notification presentation");
    const opaque = await send(name, "/probe custom_overlay");
    const opaqueRender = await until(() => render(name), (state) => state.prompts.some((prompt) => prompt.node?.blocked), "opaque overlay readonly");
    const opaquePrompt = opaqueRender.prompts.find((prompt) => prompt.kind === "custom");
    const originalLines = opaquePrompt.node.lines;
    await until(() => render(name), (state) => state.prompts.some((prompt) => prompt.node?.lines?.some((line, index) => line !== originalLines[index])), "requestRender updates opaque readonly output");
    assert.equal((await action(name, { operation: "component", componentOperation: "submit", nodeId: opaquePrompt.node.id, clientId: "desktop" })).status, "unavailable");
    await action(name, { operation: "custom-cancel", id: opaquePrompt.id });
    assert.equal((await opaque.completion).status, "completed");
    assert.ok(host.state(name).extensionUi.status.some((entry) => entry.text === "overlay disposed"));
    await command(name, "editor_component");
    await command(name, "editor_factory");
    assert.ok(host.state(name).extensionUi.notifications.some((item) => item.message === "getEditorComponent=default"), "setEditorComponent is ignored");
    assert.equal((await render(name)).editor.component, undefined);
    for (const [kind, value] of [["select", "beta"], ["confirm", true], ["input", "native input"], ["editor", "native\neditor"]]) {
      const submitted = await send(name, `/probe ${kind}`);
      const snapshot = await until(() => host.state(name), (state) => state.extensionUi.prompts.some((prompt) => prompt.kind === kind), `open ${kind}`);
      const prompt = snapshot.extensionUi.prompts.find((prompt) => prompt.kind === kind);
      if (kind === "select") assert.equal((await action(name, { operation: "dialog", id: prompt.id, value: "invalid" })).status, "unavailable");
      assert.equal((await action(name, { operation: "dialog", id: prompt.id, value })).status, "completed");
      assert.equal((await submitted.completion).status, "completed");
      assert.ok(host.state(name).extensionUi.status.some((entry) => /prompt-end/.test(entry.text)), "SDK prompt lifecycle events reach plugin");
    }
    const cancelled = await send(name, "/probe input");
    await until(() => host.state(name), (state) => state.extensionUi.prompts.length > 0, "cancellable prompt");
    await host.session(name).cancel({ operationId: cancelled.operationId });
    assert.equal((await cancelled.completion).status, "cancelled", "Explicit user stop does not require an SDK agent-aborted event for a slash command");
    assert.equal(host.state(name).extensionUi.prompts.length, 0);
    await command(name, "dialog_timeout input");
    assert.ok(host.state(name).extensionUi.notifications.some((item) => item.message === "timeout input=undefined"));
    await command(name, "dialog_signal input");
    assert.ok(host.state(name).extensionUi.notifications.some((item) => item.message === "signal input=undefined"));
    await command(name, "editor_text");
    await command(name, "paste");
    assert.equal(host.state(name).extensionUi.editor.text, "probe editor textpasted probe text");
    await command(name, "header");
    assert.match(JSON.stringify((await render(name)).header), /probe custom header/);
    await command(name, "footer");
    assert.match(JSON.stringify((await render(name)).footer), /probe footer width=80/);
    await command(name, "message-renderer");
    assert.match(JSON.stringify((await render(name)).messages), /\[message renderer\]/);
    await command(name, "message-hidden");
    assert.doesNotMatch(JSON.stringify((await render(name)).messages), /display=false custom message/);
    await command(name, "entry-renderer");
    assert.match((await render(name)).entries.flatMap((entry) => entry.node.lines.map((line) => line.trim())).join(" "), /native entry renderer/);
    await send(name, "/bridge-ansi").then((submitted) => submitted.completion);
    const ansiLine = (await render(name)).widgets.find((widget) => widget.key === "ansi-probe").node.lines[0];
    assert.ok(ansiLine.includes(`${marker("success")}success`) && ansiLine.includes(`${marker("dim")}dim`), "plugins style with the PRK web marker theme whatever the TUI theme setting");
    await command(name, "theme-set light");
    assert.match(host.state(name).extensionUi.notifications.at(-1).message, /^setTheme\(light\)=(?!ok$)/, "setTheme reports that the Web host does not switch themes");
    await command(name, "themes");
    assert.match(host.state(name).extensionUi.notifications.at(-1).message, /^theme=prk-web /);
    await assert.rejects(async () => client.request("nativeAction", { sessionId: name, requestId: randomUUID(), action: "extension-ui", worker: main.session.sessionId === created.session.sessionId ? worker.session.sessionId : main.session.sessionId, args: { operation: "editor", text: "wrong session" } }), (error) => error.code === "INVALID_REQUEST");
  }
}
