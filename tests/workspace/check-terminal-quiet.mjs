import assert from "node:assert/strict";
import { withTerminalFixture } from "./model-terminals/with-terminal-fixture.mjs";

await withTerminalFixture(async ({ call, notices, until }) => {
  const command = await call("terminal_textsend", { name: "quiet-create", text: "sleep 100", quiet_notify: true, yield_s: 0 });
  assert.equal(command.status, "running");
  await until(() => notices, (events) => events.some((event) => event.kind === "quiet" && event.result.command_id === command.command_id), "quiet_notify=true applies on first creation", 2000);
  const quietCount = () => notices.filter((event) => event.kind === "quiet" && event.result.command_id === command.command_id).length;
  const disabled = await call("terminal_textsend", { name: "quiet-create", text: "", quiet_notify: false, yield_s: 0 });
  assert.equal(disabled.command_id, command.command_id);
  assert.match(disabled.note, /quiet_notify is off/u);
  const before = quietCount();
  const pause = Promise.withResolvers();
  setTimeout(pause.resolve, 1200);
  await pause.promise;
  assert.equal(quietCount(), before, "a later textsend can disable silence notifications on the same running command");
  const enabledAt = Date.now();
  await call("terminal_textsend", { name: "quiet-create", text: "", quiet_notify: true, yield_s: 0 });
  await until(quietCount, (count) => count > before, "textsend enables quiet notifications again", 2000);
  assert(Date.now() - enabledAt >= 150, "enabling restarts quiet timing instead of firing immediately");
  await call("terminal_keysend", { name: "quiet-create", keys: "C-c", yield_s: 2 });
  await call("terminal_close", { name: "quiet-create" });
  console.log("PASS quiet_notify: first creation opt-in, same-terminal disable and re-enable, first-level restart");
});
