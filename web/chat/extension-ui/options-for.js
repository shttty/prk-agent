import { safeText } from "../../workbench/payloads/safe-text.js";
import { stripAnsi } from "../ansi/strip-ansi.js";
export const optionsFor = (options) => (Array.isArray(options) ? options : []).map((option) => typeof option === "string" ? { value: option, label: stripAnsi(option) } : { value: safeText(option?.value ?? option?.label), label: stripAnsi(option?.label ?? option?.value) });
