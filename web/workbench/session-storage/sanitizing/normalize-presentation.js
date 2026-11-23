import { isRecord } from "../../payloads/is-record.js";
import { MAX_TOOL_KEYS } from "../session-storage-constants.js";
import { safeScrollTop } from "./safe-scroll-top.js";
export function normalizePresentation(value, fallbackTop = 0) {
  const raw = isRecord(value) ? value : {};
  const anchor = isRecord(raw.anchor) && Number.isInteger(raw.anchor.index) && raw.anchor.index >= 0
    ? {
        index: raw.anchor.index,
        key: typeof raw.anchor.key === "string" ? raw.anchor.key.slice(0, 512) : "",
        role: typeof raw.anchor.role === "string" ? raw.anchor.role : "",
        text: typeof raw.anchor.text === "string" ? raw.anchor.text.slice(0, 160) : "",
        offset: Number.isFinite(raw.anchor.offset) ? raw.anchor.offset : 0,
      }
    : null;
  const openedTools = Array.isArray(raw.openedTools)
    ? raw.openedTools.filter((key) => typeof key === "string").slice(-MAX_TOOL_KEYS)
    : [];
  return {
    scrollTop: safeScrollTop(raw.scrollTop ?? fallbackTop),
    anchor,
    openedTools,
  };
}

