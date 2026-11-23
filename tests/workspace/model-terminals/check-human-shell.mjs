import assert from "node:assert/strict";
import { runBashPty } from "./run-bash-pty.mjs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HUMAN_BASH_COMMAND } from "../../../src/workspace/terminals/shell/human-bash.ts";

for (const [profile, mode] of [[".bash_profile", "string"], [".bash_login", "array"], [".profile", "array"]]) {
  const home = await mkdtemp(join(tmpdir(), "prk-human-shell-"));
  try {
    const history = join(home, ".human_history");
    // Bash reads startup history before the profile changes the exit destination.
    await writeFile(join(home, ".bash_history"), "printf 'human-history-kept\\n'\n");
    const profiles = [".bash_profile", ".bash_login", ".profile"];
    for (const later of profiles.slice(profiles.indexOf(profile) + 1)) {
      await writeFile(join(home, later), "printf 'WRONG_PROFILE\\n'\n");
    }
    await writeFile(join(home, profile), `
HISTFILE="$HOME/.human_history"
HISTSIZE=1000
HISTFILESIZE=1000
set -H
PS1='human-initial> '
__user_pc_first() { local status=$?; printf 'USER_PC_FIRST:%s\\n' "$status"; PS1='human-${mode}> '; return 17; }
__user_pc_second() { printf 'USER_PC_SECOND:%s\\n' "$?"; }
${mode === "string" ? "PROMPT_COMMAND='__user_pc_first; __user_pc_second'" : "PROMPT_COMMAND=('__user_pc_first' '__user_pc_second')"}
__user_debug() { local status=$?; if [[ $BASH_COMMAND == ': __human_probe' ]]; then printf 'USER_DEBUG:%s\\n' "$status"; fi; }
trap '__user_debug' DEBUG
printf 'PROFILE:${profile}\\n'
`);
    const [startup, failed, environment, successful] = await runBashPty(home, HUMAN_BASH_COMMAND, [
      "false; : __human_probe; (exit 7)",
      "printf 'ENV|%s|%s|%s|%s|%s|%s|%s\\n' \"$BASH_VERSION\" \"$HISTFILE\" \"$-\" \"${DEBIAN_FRONTEND-unset}\" \"${PIP_NO_INPUT-unset}\" \"${PYTHONUNBUFFERED-unset}\" \"${GIT_TERMINAL_PROMPT-unset}\"; history",
      "printf 'history-written-by-human\\n'",
    ]);
    assert.match(startup, new RegExp(`PROFILE:${profile.replaceAll(".", "\\.")}`));
    assert.doesNotMatch(startup, /WRONG_PROFILE/u, "only the first existing login profile is sourced");
    assert.match(startup, /\x1b\]133;A\x07/u);
    assert.match(startup, new RegExp(`human-${mode}> \\x1b\\]133;B\\x07`), "the user's dynamic PS1 is preserved");
    assert.doesNotMatch(startup, /\x1b\]133;[CD]/u, "startup and prompt hooks are not commands");
    assert.match(failed, /USER_DEBUG:1/u, "chained DEBUG sees the previous command's exit status");
    // Bash resets $? to the command status for each PC array element, while a
    // string follows ordinary semicolon status propagation within that string.
    const secondStatus = mode === "string" ? 17 : 7;
    assert.match(failed, new RegExp(`\\x1b\\]133;D;7\\x07USER_PC_FIRST:7\\nUSER_PC_SECOND:${secondStatus}\\n`, "u"), "PC string and array retain their distinct native status propagation");
    for (const output of [failed, environment, successful]) {
      assert.equal(output.match(/\x1b\]133;C\x07/gu)?.length, 1, "one start marker per submitted command line");
      assert.equal(output.match(/\x1b\]133;B\x07/gu)?.length, 1, "PS1 does not accumulate prompt markers");
    }
    assert.match(environment, new RegExp(`ENV\\|[^|]+\\|${history.replaceAll("/", "\\/")}\\|[^|]*i[^|]*\\|unset\\|unset\\|unset\\|unset`), "human shell remains interactive without model-only environment");
    assert.match(environment, /ENV\|[^|]+\|[^|]+\|[^|]*H[^|]*\|/u, "history expansion stays enabled");
    assert.match(environment, /\d+\s+printf 'human-history-kept\\n'/u, "saved user history is loaded");
    assert.match(successful, /\x1b\]133;D;0\x07/u);
    assert.match(await readFile(history, "utf8"), /printf 'history-written-by-human\\n'/u, "user history is saved on exit");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
console.log("human shell: login profiles, prompt hooks, DEBUG status, history and OSC markers passed");
