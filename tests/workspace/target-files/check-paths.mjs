import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { assembleFiles } from "../../../src/workspace/target-files/assemble-files.ts";

export async function checkPaths(fixture, options, files, context) {
  const root = context.cwd;
  await fixture.observe(`mkdir -p ${quoteShell(`${root}/.hidden`)} ${quoteShell(`${root}/large`)}\nln -s ${quoteShell(`${root}/.hidden`)} ${quoteShell(`${root}/linked`)}\nprintf secret > ${quoteShell(`${root}/.hidden/value`)}\nfor n in 1 2 3 4 5 6; do touch ${quoteShell(`${root}/large`)}/item$n; done\n`);
  const listed = await files.list(context);
  assert.equal(listed.path, root);
  assert.equal(listed.truncated, false);
  assert.ok(listed.entries.some((entry) => entry.name === ".hidden" && entry.type === "directory"));
  assert.ok(listed.entries.some((entry) => entry.name === "linked" && entry.type === "directory"));
  assert.equal((await files.list(context, `${root}/linked`)).entries[0].name, "value");
  const rootListing = await files.browse(context, "/");
  assert.equal(rootListing.atRoot, true);
  const narrow = assembleFiles({ ...options, workspace: { ...options.workspace, directoryEntries: 2, directoryPageEntries: 1 } });
  const truncated = await narrow.list(context, `${root}/large`);
  assert.equal(truncated.entries.length, 2);
  assert.equal(truncated.truncated, true);
  const bytes = assembleFiles({ ...options, workspace: { ...options.workspace, directoryBytes: 256 } });
  const byteListing = await bytes.list(context, `${root}/large`);
  assert.equal(byteListing.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(byteListing)) <= 256);
  for (const token of ["", ".h", "../", `${root}/`]) {
    const result = await files.referenceCandidates(context, token);
    assert.equal(typeof result.truncated, "boolean");
    assert.ok(result.candidates.every((candidate) => candidate.path.startsWith("/")));
  }
  const dot = await files.referenceCandidates(context, ".h");
  assert.ok(dot.candidates.some((candidate) => candidate.path === `${root}/.hidden` && candidate.navigable));
  assert.ok(!(await files.referenceCandidates(context)).candidates.some((candidate) => candidate.name.startsWith(".")));
  const reference = await files.readReference(context, `${root}/.hidden/value`);
  assert.equal(reference.content, "secret");
  await assert.rejects(files.referenceCandidates(context, "~/"), { code: "INVALID_REQUEST" });
  await assert.rejects(files.list({ ...context, cwd: `${root}/missing` }), { code: "NOT_FOUND" });
  await assert.rejects(files.list({ ...context, cwd: `${root}/.hidden/value` }), { code: "INVALID_REQUEST" });
  await files.delete(context, `${root}/linked`);
  assert.equal((await files.read(context, `${root}/.hidden/value`)).content, "secret");
  if (fixture.mode === "office") {
    await mkdir(`${root}/bait`, { recursive: true });
    await writeFile(`${root}/bait/local-only`, "GATEWAY DECOY");
    try { await assert.rejects(files.list(context, `${root}/bait`), { code: "NOT_FOUND" }); }
    finally { await rm(root, { recursive: true }); }
  }
  const small = assembleFiles({ ...options, workspace: { ...options.workspace, fileReadBytes: 2 }, references: { ...options.references, maxBytes: 2 } });
  await assert.rejects(small.read(context, `${root}/.hidden/value`), { code: "TOO_LARGE" });
  await assert.rejects(small.readReference(context, `${root}/.hidden/value`), { code: "TOO_LARGE" });
  console.log(JSON.stringify({ check: "paths-budgets", status: "PASS", root }));
}
