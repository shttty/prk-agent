import { withTerminalFixture } from "./model-terminals/with-terminal-fixture.mjs";
import { checkModelBrake } from "./terminal-brake/check-model-brake.mjs";
import { checkExemptOutput } from "./terminal-brake/check-exempt-output.mjs";
import { checkHumanOutput } from "./terminal-brake/check-human-output.mjs";
import { checkLongLineOutput } from "./terminal-brake/check-long-line-output.mjs";
import { checkRawByteThreshold } from "./terminal-brake/check-raw-byte-threshold.mjs";
import { checkHistoryBytes } from "./terminal-brake/check-history-bytes.mjs";
import { checkCompletePagination } from "./terminal-brake/check-complete-pagination.mjs";
import { checkResistantBrake } from "./terminal-brake/check-resistant-brake.mjs";

const options = {
  commandOutputLimitBytes: 512, truncatedHeadBytes: 7, truncatedTailBytes: 7,
  historyBytes: 4096, historyCommands: 20, outputBytes: 32, scrollbackLines: 30,
};

const checks = new Map([
  ["brake", checkModelBrake], ["exempt", checkExemptOutput], ["human", checkHumanOutput],
  ["longline", checkLongLineOutput], ["rawbytes", checkRawByteThreshold], ["complete", checkCompletePagination], ["rebuild", checkResistantBrake],
  ["history", checkHistoryBytes],
]);
const selected = process.argv.slice(2).map((arg) => {
  if (!arg.startsWith("--case=") || !checks.has(arg.slice(7))) throw new Error(`Unknown terminal-brake case: ${arg}`);
  return arg.slice(7);
});
const enabled = (name) => selected.length === 0 || selected.includes(name);
const shared = [...checks].filter(([name]) => name !== "history" && enabled(name));
if (shared.length) await withTerminalFixture(async (fixture) => {
  for (const [, check] of shared) {
    await check(fixture);
    for (const terminal of fixture.transport.list(fixture.sessionId).terminals) await fixture.terminals.close(terminal.name);
  }
}, options);
if (enabled("history")) await withTerminalFixture(checkHistoryBytes, { ...options, historyBytes: 180 });
console.log(`PASS terminal output brake: ${(selected.length ? selected : [...checks.keys()]).join(", ")}`);
