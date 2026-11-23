import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";

export async function awaitTargetFile(fixture, path) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const text = await fixture.observe(`if test -s ${quoteShell(path)}; then cat ${quoteShell(path)}; fi\n`);
    if (text.trim()) return text;
    await delay(20);
  }
  assert.fail(`Owned target file never appeared: ${path}`);
}
