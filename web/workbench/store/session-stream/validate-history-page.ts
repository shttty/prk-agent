import type { HistoryPage } from "./session-stream-types.ts";
import { isRecord } from "../../payloads/is-record.ts";

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

/** A history page from the Gateway, checked once here; its messages are taken as sent. */
export function validHistoryPage(page: unknown): page is HistoryPage {
  return isRecord(page) && Array.isArray(page.messages) && isStrings(page.messageEntryIds)
    && page.messageEntryIds.length === page.messages.length
    && (page.historyBefore === null || typeof page.historyBefore === "string")
    && (page.historyForkBefore === null || typeof page.historyForkBefore === "string") && Array.isArray(page.compactions)
    && isStrings(page.compactionEntryIds);
}
