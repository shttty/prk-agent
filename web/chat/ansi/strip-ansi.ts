import { safeText } from "../../workbench/payloads/safe-text.js";
import { ANSI_RE } from "./ansi-patterns.ts";
export const stripAnsi = (value: unknown): string => safeText(value).replace(ANSI_RE, "");
