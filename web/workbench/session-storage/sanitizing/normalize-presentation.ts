import type { Presentation, PresentationAnchor } from "../session-storage-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { MAX_TOOL_KEYS } from "../session-storage-constants.ts";
import { safeScrollTop } from "./safe-scroll-top.ts";

export function normalizePresentation(value: unknown, fallbackTop = 0): Presentation {
  const raw = isRecord(value) ? value : {};
  return {
    scrollTop: safeScrollTop(raw.scrollTop ?? fallbackTop),
    anchor: normalizeAnchor(raw.anchor),
    openedTools: Array.isArray(raw.openedTools)
      ? raw.openedTools.filter((key): key is string => typeof key === "string").slice(-MAX_TOOL_KEYS)
      : [],
  };
}

function normalizeAnchor(value: unknown): PresentationAnchor | null {
  if (!isRecord(value) || typeof value.index !== "number" || !Number.isInteger(value.index) || value.index < 0) return null;
  return {
    index: value.index,
    key: typeof value.key === "string" ? value.key.slice(0, 512) : "",
    role: typeof value.role === "string" ? value.role : "",
    text: typeof value.text === "string" ? value.text.slice(0, 160) : "",
    offset: typeof value.offset === "number" && Number.isFinite(value.offset) ? value.offset : 0,
  };
}
