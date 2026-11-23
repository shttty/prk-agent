import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ToolLibrary } from "../../../src/codemode/tool-library/assemble-tool-library.ts";
import { DEFAULT_TOOLS_OPTIONS } from "../../../src/config/tools/tools-options.ts";
import { parseToolsOptions } from "../../../src/config/tools/parse-tools-options.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";

export async function verifyLibraryLifecycle(home) {
  assert.deepEqual(parsePrkConfig({}).tools, DEFAULT_TOOLS_OPTIONS);
  for (const tools of [null, { unknown: 1 }, { staging: null }, { staging: { capacity: 0 } }, { promoted: { idleDays: 1.5 } }, { promotion: { distinctSessions: -1 } }, { archive: { capacity: Number.MAX_SAFE_INTEGER + 1 } }, { versionsKept: "5" }, { staging: { extra: 1 } }]) assert.throws(() => parseToolsOptions(tools));
  for (const method of ["toolsPromote", "toolsDemote", "toolsArchive", "toolsRestore", "toolsDelete"]) {
    assert.throws(() => validateRequest({ v: 1, id: 1, method, params: { name: "count_lines", target: "ignored" } }));
  }
  assert.throws(() => validateRequest({ v: 1, id: 1, method: "toolsList", params: { name: "wrong" } }));

  let clock = Date.parse("2026-01-01T00:00:00Z");
  const options = parseToolsOptions({ staging: { capacity: 2, idleDays: 2 }, promoted: { capacity: 1, idleDays: 2 }, promotion: { distinctSessions: 3 }, archive: { capacity: 2 }, versionsKept: 2 });
  const lifecycleHome = join(home, "lifecycle");
  const library = new ToolLibrary(lifecycleHome, options, () => clock);
  const source = (name, reason = `Increment inputs for recurring ${name} calculations.`) => ({ name, source: `def ${name}(x):\n    return x + 1`, imports: [], signature: "(x)", docstring: "Increment.", reason });
  const entry = (name) => library.list().find((item) => item.name === name);
  const { reason: _reason, ...withoutReason } = source("refused");
  for (const candidate of [withoutReason, source("refused", ""), source("refused", " \t\n ")]) {
    assert.throws(() => library.save(candidate), /Persisted tools require a nonblank reason describing future tasks that will reuse them\./);
    assert(!library.list().some((item) => item.name === "refused"));
  }
  library.save(source("one", "  Increment inputs for recurring first-tool calculations.  "));
  assert.equal(entry("one").reason, "Increment inputs for recurring first-tool calculations.");
  assert.equal(entry("one").successfulCalls, 0);
  library.used("one", 1, "native-session-1");
  library.used("one", 1, "native-session-1");
  assert.equal(entry("one").distinctSessions, 1);
  assert.equal(entry("one").successfulCalls, 2);
  assert.equal(entry("one").status, "staging");
  library.used("one", 1, "native-session-2");
  library.used("one", 1, "native-session-3");
  assert.equal(entry("one").status, "promoted");
  library.change("promote", "one");
  library.save(source("one", "  Increment inputs for recurring revised first-tool calculations.  "));
  assert.equal(entry("one").version, 2);
  assert.equal(entry("one").distinctSessions, 3);
  assert.equal(entry("one").successfulCalls, 4);
  assert.equal(entry("one").reason, "Increment inputs for recurring revised first-tool calculations.");
  assert.equal(entry("one").manual, true);
  assert.equal(entry("one").status, "promoted");
  assert.equal(library.list().find((item) => item.name === "one" && item.version === 1).status, "archived");
  library.save(source("two"));
  for (let n = 1; n <= 3; n++) library.used("two", 1, `native-two-${n}`);
  assert.equal(entry("two").status, "staging", "all-manual promoted capacity leaves automatic candidates staging");
  assert.throws(() => library.change("promote", "two"), (error) => error.code === "BUSY");
  library.save(source("three"));
  library.save(source("four"));
  assert.equal(entry("three").status, "archived", "never-used lowest-score staging source loses overflow");
  library.change("demote", "one");
  assert.equal(entry("two").status, "promoted", "pending automatic tool gets the manually freed slot on access");
  assert.equal(entry("one").status, "staging");
  clock += 2 * 86_400_000;
  assert.equal(entry("two").status, "staging", "automatic promoted tool ages into a new competition period");
  assert.equal(entry("one").status, "archived");
  library.change("restore", "one");
  library.change("promote", "one");
  clock += 4 * 86_400_000;
  assert.equal(entry("one").status, "promoted", "manual promotion never ages");
  library.change("archive", "one");
  assert.equal(entry("one").manual, false);
  library.change("restore", "one");
  library.save(source("one"));
  assert.equal(library.list().filter((item) => item.name === "one").length, 2);
  assert(library.list().filter((item) => item.status === "archived").length <= 2);
  const persisted = new ToolLibrary(lifecycleHome, options, () => clock).list().find((item) => item.name === "one");
  assert.equal(persisted.version, 3);
  assert.equal(persisted.successfulCalls, 4);
  assert.equal(persisted.reason, "Increment inputs for recurring one calculations.");
  library.change("delete", "one");
  assert(!library.list().some((item) => item.name === "one"));
  assert.throws(() => library.change("restore", "missing"), (error) => error.code === "NOT_FOUND");

  const overflow = new ToolLibrary(join(home, "overflow"), parseToolsOptions({ staging: { capacity: 3 }, promoted: { capacity: 2 }, promotion: { distinctSessions: 2 } }), () => clock);
  overflow.save(source("pinned")); overflow.change("promote", "pinned");
  overflow.save(source("weak")); overflow.used("weak", 1, "weak-1"); overflow.used("weak", 1, "weak-2");
  for (let n = 0; n < 10; n++) overflow.used("weak", 1, "weak-2");
  assert.equal(overflow.active("weak").successfulCalls, 12);
  clock++;
  overflow.save(source("strong")); overflow.used("strong", 1, "strong-1"); overflow.used("strong", 1, "strong-2");
  assert.equal(overflow.active("weak").status, "staging", "more calls cannot outweigh sessions and recency in promotion competition");
  assert.equal(overflow.active("strong").status, "promoted");
  assert.equal(overflow.active("pinned").manual, true, "manual promotion is never an overflow victim");
  const invalidHome = join(home, "invalid-library");
  await mkdir(join(invalidHome, "tools"), { recursive: true });
  const stored = { ...source("invalid"), version: 1, status: "staging", manual: false, promotionReady: false, sessions: [], successfulCalls: 0, createdAt: new Date(clock).toISOString(), changedAt: new Date(clock).toISOString() };
  for (const field of ["reason", "successfulCalls"]) {
    const incomplete = { ...stored };
    delete incomplete[field];
    await writeFile(join(invalidHome, "tools", "library.json"), JSON.stringify([incomplete]));
    assert.throws(() => new ToolLibrary(invalidHome), /Invalid tool library document/);
  }
  for (const invalid of [{ name: "invalid" }, { ...stored, reason: " \t\n " }, { ...stored, successfulCalls: -1 }, { ...stored, successfulCalls: 0.5 }]) {
    await writeFile(join(invalidHome, "tools", "library.json"), JSON.stringify([invalid]));
    assert.throws(() => new ToolLibrary(invalidHome), /Invalid tool library document/);
  }
}
