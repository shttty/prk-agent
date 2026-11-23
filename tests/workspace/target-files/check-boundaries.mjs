import assert from "node:assert/strict";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { assembleFiles } from "../../../src/workspace/target-files/assemble-files.ts";

export async function checkBoundaries(fixture, options, files, context) {
  const root = fixture.root;
  const bytes = Buffer.alloc(options.workspace.fileReadBytes, 0x61);
  bytes.set(Buffer.from("β\r\n"), options.workspace.fileChunkBytes - 1);
  const path = `${root}/chunks.bin`;
  await files.create(context, { path, type: "file", format: "base64", content: bytes.toString("base64") });
  const read = await files.read(context, path, "base64");
  assert.deepEqual(Buffer.from(read.content, "base64"), bytes);
  await fixture.observe(`printf x >> ${quoteShell(path)}\n`);
  await assert.rejects(files.read(context, path), { code: "TOO_LARGE" });
  const directory = `${root}/exact`;
  await fixture.observe(`mkdir ${quoteShell(directory)}\ntouch ${quoteShell(`${directory}/a`)} ${quoteShell(`${directory}/b`)}\n`);
  const narrow = assembleFiles({ ...options, workspace: { ...options.workspace, directoryEntries: 2, directoryPageEntries: 1 }, references: { ...options.references, maxEntries: 1 } });
  assert.equal((await narrow.list(context, directory)).truncated, false);
  assert.equal((await narrow.referenceCandidates(context, `${directory}/`)).truncated, true);
  const denied = `${root}/denied`;
  await fixture.observe(`mkdir ${quoteShell(denied)}\nchmod 000 ${quoteShell(denied)}\n`);
  try { await assert.rejects(files.list(context, denied), (error) => error.details?.reason === "forbidden"); }
  finally { await fixture.observe(`chmod 700 ${quoteShell(denied)}\n`); }
  const big = `${root}/large-copy.bin`;
  await fixture.observe(`dd if=/dev/zero of=${quoteShell(big)} bs=1048576 count=8 2>/dev/null\n`);
  const copied = await files.copy(context, big, root);
  assert.equal(copied.size, 8388608);
  await fixture.observe(`cmp ${quoteShell(big)} ${quoteShell(copied.path)}\n`);
  assert.ok(Buffer.byteLength(JSON.stringify(copied)) < 1024);
  await assert.rejects(files.read(context, copied.path), { code: "TOO_LARGE" });
  console.log(JSON.stringify({ check: "chunk-permission-copy-boundaries", status: "PASS", uploadBytes: bytes.length, targetCopyBytes: copied.size, copyResponseBytes: Buffer.byteLength(JSON.stringify(copied)), root }));
}
