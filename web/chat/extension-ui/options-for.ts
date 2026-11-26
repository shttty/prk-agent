import { safeText } from "../../workbench/payloads/safe-text.js";
import { stripAnsi } from "../ansi/strip-ansi.ts";
type OptionInput = string | { value?: string; label?: string };
export const optionsFor = (options: readonly OptionInput[] | undefined) => (options ?? []).map((option) => typeof option === "string" ? { value: option, label: stripAnsi(option) } : { value: safeText(option.value ?? option.label), label: stripAnsi(option.label ?? option.value) });
