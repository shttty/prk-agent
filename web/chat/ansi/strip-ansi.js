import { safeText } from "../../workbench/payloads/safe-text.js";
import { ANSI_RE } from "./ansi-patterns.js";
export const stripAnsi = (value) => safeText(value).replace(ANSI_RE, "");
