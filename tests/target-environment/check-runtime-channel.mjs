import assert from "node:assert/strict";
import { checkSharedRuntime } from "./runtime-channel/check-shared-runtime.mjs";
import { checkWindow } from "./runtime-channel/check-window.mjs";
import { checkRuntimeDisconnect } from "./runtime-channel/check-runtime-disconnect.mjs";
import { checkStartup } from "./runtime-channel/check-startup.mjs";
import { checkOutputBounds } from "./runtime-channel/check-output-bounds.mjs";

const mode = process.argv[2] ?? "local";
const selected = process.argv[3] ?? "all";
const scenarios = {
  shared: () => checkSharedRuntime(mode),
  "window-count-cancel": () => checkWindow(mode, "count", "cancel"),
  "window-count-timeout": () => checkWindow(mode, "count", "timeout"),
  "window-bytes-cancel": () => checkWindow(mode, "bytes", "cancel"),
  "window-bytes-timeout": () => checkWindow(mode, "bytes", "timeout"),
  disconnect: () => checkRuntimeDisconnect(mode),
  startup: () => checkStartup(mode),
  "output-bounds": () => checkOutputBounds(mode),
};
assert.ok(selected === "all" || Object.hasOwn(scenarios, selected), `Unknown runtime scenario: ${selected}`);
for (const [name, run] of Object.entries(scenarios)) {
  if (selected !== "all" && selected !== name) continue;
  console.log(JSON.stringify({ mode, status: "PASS", ...await run() }));
}
