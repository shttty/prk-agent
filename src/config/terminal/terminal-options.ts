export interface TerminalOptions {
  readonly modelHistoryFile: string;
  readonly yieldMs: number;
  readonly maxYieldMs: number;
  readonly foregroundQuietMs: number;
  readonly timeoutMs: number;
  readonly quietNotifyDefault: boolean;
  readonly outputBrakeDefault: boolean;
  readonly quietLadderMs: readonly number[];
  readonly scrollbackLines: number;
  readonly outputBytes: number;
  readonly historyCommands: number;
  readonly commandOutputLimitBytes: number;
  readonly truncatedHeadBytes: number;
  readonly truncatedTailBytes: number;
  readonly historyBytes: number;
  readonly longLineThresholdChars: number;
  readonly longLineHeadChars: number;
  readonly longLineTailChars: number;
  readonly longLineContextChars: number;
}

export const DEFAULT_TERMINAL_OPTIONS: TerminalOptions = Object.freeze({
  modelHistoryFile: "~/.bash_history.prk-model",
  yieldMs: 10_000,
  maxYieldMs: 300_000,
  foregroundQuietMs: 30_000,
  timeoutMs: 0,
  quietNotifyDefault: false,
  outputBrakeDefault: true,
  quietLadderMs: Object.freeze([10_000, 60_000, 300_000, 1_800_000]),
  scrollbackLines: 100_000,
  outputBytes: 50_000,
  historyCommands: 100,
  commandOutputLimitBytes: 16 * 1024 * 1024,
  truncatedHeadBytes: 4096,
  truncatedTailBytes: 4096,
  historyBytes: 64 * 1024 * 1024,
  longLineThresholdChars: 2000,
  longLineHeadChars: 80,
  longLineTailChars: 80,
  longLineContextChars: 40,
});
