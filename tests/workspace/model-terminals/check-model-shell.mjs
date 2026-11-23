import assert from "node:assert/strict";
import { runBashPty } from "./run-bash-pty.mjs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createModelBashCommand } from "../../../src/workspace/terminals/shell/model-bash.ts";

function runShell(home, historyFile, commands) {
  return runBashPty(home, createModelBashCommand(historyFile), commands, { hardKill: true });
}

for (const mode of ["string", "array"]) {
  for (const configured of [undefined, "~/custom history'$(touch INJECTED)"]) {
    const home = await mkdtemp(join(tmpdir(), "prk-model-shell-"));
    try {
      const historyFile = parsePrkConfig({ terminal: configured === undefined ? {} : { modelHistoryFile: configured } }).terminal.modelHistoryFile;
      const historyPath = join(home, historyFile.slice(2));
      const humanHistory = "printf 'human-history-must-stay-private\\n'\n";
      await writeFile(join(home, ".bash_history"), humanHistory);
      await writeFile(historyPath, "printf 'model-history-kept\\n'\n");
      await writeFile(join(home, ".bash_profile"), `
export MODEL_PROFILE=loaded
alias model_alias='printf "ALIAS_OK\\n"'
HISTSIZE=321
HISTFILESIZE=654
HISTCONTROL=ignoredups
PS1='user-initial> '
__user_pc() { printf 'USER_PC:%s\\n' "$?"; PS1='user-model> '; }
PROMPT_COMMAND=${mode === "string" ? "'__user_pc'" : "('__user_pc')"}
__user_debug() { local status=$?; if [[ $BASH_COMMAND == ": model_debug_probe" ]]; then printf 'USER_DEBUG:%s\\n' "$status"; fi; }
trap '__user_debug' DEBUG
`);
      const firstCommand = "printf 'first-model-command\\n'";
      const secondCommand = "printf 'second-model-command\\n'";
      const [startup, environment, alias, failed, first, second] = await runShell(home, historyFile, [
        "printf 'ENV|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\\n' \"$MODEL_PROFILE\" \"$DEBIAN_FRONTEND\" \"$PIP_NO_INPUT\" \"$PYTHONUNBUFFERED\" \"$GIT_TERMINAL_PROMPT\" \"$HISTSIZE\" \"$HISTFILESIZE\" \"$HISTCONTROL\" \"$HISTFILE\" \"$-\" \"$COLORTERM\"; history; shopt -p histappend; bind -v | grep enable-bracketed-paste",
        "model_alias", "false; : model_debug_probe; (exit 7)", firstCommand, secondCommand,
      ]);
      assert.match(startup, /user-model> \x1b\]133;B\x07/u, "user prompt is preserved");
      assert.match(environment, /ENV\|loaded\|noninteractive\|1\|1\|0\|321\|654\|ignoredups\|/u);
      assert.ok(environment.includes(`|${historyPath}|`), "history path expands in the target shell");
      assert.match(environment, /\|[^|\n]*i[^|\n]*\|truecolor/u);
      assert.doesNotMatch(environment, /\|[^|\n]*H[^|\n]*\|truecolor/u, "history expansion is disabled");
      assert.match(environment, /shopt -s histappend/u);
      assert.match(environment, /enable-bracketed-paste on/u);
      assert.match(environment, /model-history-kept/u);
      assert.doesNotMatch(environment, /human-history-must-stay-private/u, "startup user history is cleared");
      assert.match(alias, /\x1b\]133;C\x07ALIAS_OK\n/u);
      assert.match(failed, /USER_DEBUG:1/u);
      assert.match(failed, /\x1b\]133;D;7\x07USER_PC:7\n/u, "user prompt command receives exit status");
      for (const output of [environment, alias, failed, first, second]) {
        assert.match(output, /USER_PC:/u);
        assert.equal(output.match(/\x1b\]133;C\x07/gu)?.length, 1);
        assert.equal(output.match(/\x1b\]133;B\x07/gu)?.length, 1);
      }
      const saved = await readFile(historyPath, "utf8");
      assert.ok(saved.includes(firstCommand) && saved.includes(secondCommand), "each prompt persists history before a hard kill");
      await runShell(home, historyFile, ["printf 'another-model-terminal\\n'"]);
      const appended = await readFile(historyPath, "utf8");
      assert.ok(appended.includes(firstCommand) && appended.includes("another-model-terminal"), "another terminal appends without overwriting");
      assert.equal(await readFile(join(home, ".bash_history"), "utf8"), humanHistory);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }
}

// Replay the exact bootstrap passed to ssh in each hop's own PTY and HOME.
const hopRoot = await mkdtemp(join(tmpdir(), "prk-model-hops-"));
try {
  const historyFile = "~/model-history";
  const bin = join(hopRoot, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "ssh"), `#!/bin/bash
[[ $1 == -t && $# == 3 ]] || exit 2
printf %s "$3" > "$HOME/next-hop"
`, { mode: 0o700 });
  let argv = createModelBashCommand(historyFile);
  for (let hop = 0; hop <= 2; hop++) {
    const home = join(hopRoot, String(hop));
    const seeded = [`echo saved-${hop}-first`, `echo saved-${hop}-second`];
    await mkdir(home);
    await writeFile(join(home, ".bash_profile"), 'export PATH="$HOME/../bin:$PATH"\nHISTSIZE=1000\nunset HISTTIMEFORMAT\n');
    await writeFile(join(home, "model-history"), seeded.join("\n") + "\n");
    const [, history] = await runBashPty(home, argv, ["printf '\\n'; history", ...(hop < 2 ? ["prk_ssh fixture"] : [])], { hardKill: true });
    const saved = [...history.matchAll(/^ +\d+ +(echo saved-\d+-(?:first|second))$/gm)].map((match) => match[1]);
    assert.deepEqual(saved, seeded, `hop ${hop} loads each saved history entry exactly once`);
    if (hop < 2) argv = ["/bin/bash", "--noprofile", "--norc", "-c", await readFile(join(home, "next-hop"), "utf8")];
  }
} finally {
  await rm(hopRoot, { recursive: true, force: true });
}
console.log("model shell: profiles, user hooks, isolated history, custom paths and SSH hops passed");
