import { DEFAULT_TERMINAL_OPTIONS, type TerminalOptions } from "./terminal-options.ts";

export function parseTerminalOptions(value: unknown): TerminalOptions {
  const defaults = DEFAULT_TERMINAL_OPTIONS;
  if (value === undefined) return { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid PRK configuration: terminal must be an object.");
  const options = { ...defaults };
  for (const [key, option] of Object.entries(value)) {
    const fail = (reason: string): never => { throw new Error(`Invalid PRK configuration: terminal.${key} ${reason}.`); };
    if (!Object.hasOwn(defaults, key)) fail("is unsupported");
    if (key === "modelHistoryFile") {
      if (typeof option !== "string" || option.length === 0 || /[\0\r\n]/u.test(option)) fail("must be a nonempty string without NUL or newlines");
      Object.assign(options, { modelHistoryFile: option });
    } else if (key === "quietNotifyDefault" || key === "outputBrakeDefault") {
      if (typeof option !== "boolean") fail("must be a boolean");
      Object.assign(options, { [key]: option });
    } else if (key === "quietLadderMs") {
      if (!Array.isArray(option) || option.length === 0 || option.some((entry, index) =>
        typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < 1 || entry > 2_147_483_647
        || (index > 0 && entry < option[index - 1]))) fail("must be a nonempty ascending array of positive timer integers");
      Object.assign(options, { quietLadderMs: [...option as number[]] });
    } else {
      const zero = key === "yieldMs" || key === "timeoutMs";
      const max = key.endsWith("Bytes") ? Number.MAX_SAFE_INTEGER : 2_147_483_647;
      if (typeof option !== "number" || !Number.isSafeInteger(option) || option < (zero ? 0 : 1) || option > max) {
        fail(`must be a safe integer from ${zero ? 0 : 1} to ${max}`);
      }
      Object.assign(options, { [key]: option });
    }
  }
  if (options.yieldMs > options.maxYieldMs) throw new Error("Invalid PRK configuration: terminal.yieldMs must not exceed terminal.maxYieldMs.");
  // A page must be able to carry one complete UTF-8 code point.
  if (options.outputBytes < 4) throw new Error("Invalid PRK configuration: terminal.outputBytes must be at least 4.");
  return options;
}
