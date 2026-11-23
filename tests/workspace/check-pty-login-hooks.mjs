import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { createPtyTerminals } from "../../src/workspace/pty-terminals/assemble-terminals.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../src/config/workspace/workspace-options.ts";

const root = await mkdtemp("/tmp/prk-S3-hooks-");
process.env.HOME = root; process.env.PRK_HOME = `${root}/prk`;
await mkdir(process.env.PRK_HOME);
await writeFile(`${root}/.bash_profile`, String.raw`
PROMPT_COMMAND=('printf "\\nS3_PC_A:%s\\n" "$?"' 'false' 'printf "S3_PC_B:%s\\n" "$?"' 'PS1="S3_USER> "')
trap 'if [[ $BASH_COMMAND == false ]]; then printf "S3_USER_DEBUG\\n"; fi' DEBUG
`);
const envs = createTargetEnvironments({ resolve: () => ({ local: true }) });
const terminals = createPtyTerminals({ workspace: DEFAULT_WORKSPACE_OPTIONS, runtime: async () => ({ python: process.env.PI_TEST_PYTHON, basePython: process.env.PI_TEST_PYTHON, env: {} }), acquire: (id) => envs.acquire(id), ownerTarget: () => "owned", onCleanupUnknown: (error) => console.error(error) });
try {
  await terminals.open("hooks", { cwd: root }, "human");
  assert.equal(await terminals.integration("hooks", "human"), "ready");
  let output = "";
  const sub = terminals.subscribe("hooks", "human", (event) => { if (event.type === "stdout") output += event.data; });
  output = sub.snapshot.replay;
  console.log(JSON.stringify({ firstPrompt: output }));
  assert.match(output, /S3_PC_A:0/);
  assert.match(output, /S3_PC_B:1/);
  assert.match(output, /S3_USER> /);
  assert.match(output, /S3_USER_DEBUG/);
  output = "";
  terminals.input("hooks", "human", "false\r");
  for (let n = 0; n < 100 && !output.includes("\x1b]133;D;1\x07"); n++) await delay(20);
  assert.match(output, /\x1b\]133;C\x07/);
  assert.match(output, /\x1b\]133;D;1\x07/);
  assert.match(output, /S3_USER_DEBUG/);
  assert.match(output, /S3_PC_A:1/);
  assert.match(output, /S3_PC_B:1/);
  console.log(JSON.stringify({ commandPrompt: output, status: "PASS" }));
  sub.unsubscribe();
} finally { await terminals.shutdown(); await rm(root, { recursive: true, force: true }); }
