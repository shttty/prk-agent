import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function prepareLspWorkspace({ tempRoot, bunSha256, bundlePaths, target, targetRoot, q, exists }) {
  const remoteRuntime = join(tempRoot, ".cache/prk/bin", bunSha256, "bun");
  const languageServer = join(bundlePaths.languageServers, "node_modules/typescript-language-server/lib/cli.mjs");
  const server = `${target}/typescript-language-server`;
  await writeFile(join(targetRoot, "typescript-language-server"), `#!/bin/bash\necho $$ >> ${q(`${target}/workspace/lsp-pids`)}\nexec ${q(remoteRuntime)} ${q(languageServer)} --stdio\n`);
  await chmod(join(targetRoot, "typescript-language-server"), 0o700);
  const lspConfig = JSON.stringify({ timeout: 15000, servers: { typescript: { command: [server], extensions: [".ts"], languageId: "typescript", initialization: { hostInfo: "prk-remote-acceptance" } } } });
  for (const directory of [".pi", ".prk"]) {
    await mkdir(join(targetRoot, "workspace", directory), { recursive: true });
    await writeFile(join(targetRoot, "workspace", directory, "pi-lsp.json"), lspConfig);
  }
  assert.equal(await exists(server), false, "Configured target LSP executable does not exist in Gateway namespace");
  assert.equal(await exists(`${target}/workspace/example.ts`), false, "Target workspace does not exist in Gateway namespace");
  return server;
}
