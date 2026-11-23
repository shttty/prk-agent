import { isRecord } from "../../../workbench/payloads/is-record.js";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { trimDisplay } from "./trim-display.js";
export function nativePayloadText(action, data, status) {
  if (!isRecord(data)) return "";
  if (action === "compact") return status === "completed" && Number.isFinite(data.tokensBefore) ? `压缩前约 ${data.tokensBefore} tokens` : "";
  if (!["session", "changelog", "hotkeys", "settings", "help"].includes(action)) return "";
  if (action === "changelog") return trimDisplay([safeText(data.version) ? `版本 ${safeText(data.version)}` : "", safeText(data.changelog)].filter(Boolean).join("\n\n"));
  if (action === "hotkeys") {
    const actions = Array.isArray(data.actions) ? data.actions.map(safeText).filter(Boolean) : [];
    const prefixes = Array.isArray(data.prefixes) ? data.prefixes.map(safeText).filter(Boolean) : [];
    return trimDisplay([actions.length ? `操作：${actions.join("、")}` : "", prefixes.length ? `前缀：${prefixes.join("、")}` : ""].filter(Boolean).join("\n"));
  }
  try { return trimDisplay(JSON.stringify(data, null, 2)); } catch { return "返回的数据无法显示。"; }
}
