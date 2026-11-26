import { sessionEntryToContextMessages, type SessionEntry, type SessionManager } from "@earendil-works/pi-coding-agent";
import type { BranchHistoryPage, HistoryPageCursor } from "./history-types.ts";

const PAGE_TURNS = 50;

type Message = BranchHistoryPage["messages"][number];
type PageBudget = { bytes: number; projectMessage: (message: Message) => Message };

export class HistoryTurnTooLarge extends Error {
  readonly entryId: string | null;
  readonly bytes: number;
  readonly budgetBytes: number;

  constructor(entryId: string | null, bytes: number, budgetBytes: number) {
    super(`History turn ${entryId ?? "(empty branch)"} needs ${bytes} bytes; page budget is ${budgetBytes}.`);
    this.entryId = entryId;
    this.bytes = bytes;
    this.budgetBytes = budgetBytes;
  }
}

export function projectBranchPage(manager: SessionManager): BranchHistoryPage;
export function projectBranchPage(manager: SessionManager, cursor: HistoryPageCursor, budget?: PageBudget): BranchHistoryPage | null;
export function projectBranchPage(manager: SessionManager, cursor: HistoryPageCursor = {}, budget?: PageBudget): BranchHistoryPage | null {
  let branch = manager.getBranch();
  const { before, through } = cursor;
  if (through === null) branch = [];
  else if (through !== undefined) {
    const anchor = branch.findIndex((entry) => entry.id === through);
    if (anchor < 0) return null;
    branch = branch.slice(0, anchor + 1);
  }
  const end = before === undefined ? branch.length : branch.findIndex((entry) => entry.id === before && isUser(entry));
  if (end < 0) return null;

  const starts: number[] = [];
  for (let i = end - 1; i >= 0 && starts.length <= PAGE_TURNS; i--) {
    const entry = branch[i];
    if (entry && isUser(entry)) starts.push(i);
  }
  if (starts.length <= PAGE_TURNS) starts[Math.max(0, starts.length - 1)] = 0;
  else starts.pop();

  const compactionMarks = projectCompactionMarks(branch);
  const compactionEntryIds = compactionMarks.map(({ entry }) => entry.entryId);
  const turns: Pick<BranchHistoryPage, "messages" | "messageEntryIds">[] = [];
  let bodyBytes = 0;
  let entryCount = 0;
  let metadata: Omit<BranchHistoryPage, "messages" | "messageEntryIds"> | undefined;
  for (const [i, start] of starts.entries()) {
    const messages: BranchHistoryPage["messages"] = [];
    const messageEntryIds: string[] = [];
    for (const entry of branch.slice(start, i === 0 ? end : starts[i - 1])) {
      if (entry.type === "compaction") continue;
      for (const message of sessionEntryToContextMessages(entry)) {
        messages.push(budget ? budget.projectMessage(message) : message);
        messageEntryIds.push(entry.id);
      }
    }
    const candidate = {
      historyBefore: start ? branch[start]?.id ?? null : null,
      historyForkBefore: previousReply(branch, start),
      compactions: compactionMarks.filter(({ index, anchor }) =>
        (anchor >= start && (anchor < end || before === undefined)) || (index >= start && index < end)).map(({ entry }) => entry),
      compactionEntryIds,
    };
    if (budget) {
      // Count the exact JSON bytes: [] delimiters are in the page shell; two commas join two nonempty groups.
      const nextBytes = bodyBytes + jsonBytes(messages) + jsonBytes(messageEntryIds) - 4 + (entryCount && messages.length ? 2 : 0);
      const bytes = jsonBytes({ messages: [], messageEntryIds: [], ...candidate }) + nextBytes;
      if (bytes > budget.bytes) {
        if (!metadata) {
          const first = branch.slice(start, end).find(isUser) ?? branch[start];
          throw new HistoryTurnTooLarge(first?.id ?? null, bytes, budget.bytes);
        }
        break;
      }
      bodyBytes = nextBytes;
      entryCount += messages.length;
    }
    metadata = candidate;
    turns.push({ messages, messageEntryIds });
  }
  turns.reverse();
  return { ...metadata!, messages: turns.flatMap((turn) => turn.messages), messageEntryIds: turns.flatMap((turn) => turn.messageEntryIds) };
}

function isUser(entry: SessionEntry): boolean {
  return entry.type === "message" && entry.message.role === "user";
}

function previousReply(branch: SessionEntry[], start: number): string | null {
  for (let i = start - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type === "message" && entry.message.role === "assistant" && Array.isArray(entry.message.content)
      && !entry.message.content.some((part) => part.type === "toolCall")) return entry.id;
  }
  return null;
}

function projectCompactionMarks(branch: SessionEntry[]) {
  const positions = new Map(branch.map((entry, index) => [entry.id, index]));
  return branch.flatMap((entry, index) => {
    if (entry.type !== "compaction") return [];
    // A compaction can refer to bookkeeping or itself when nothing was retained.
    let anchor = positions.get(entry.firstKeptEntryId) ?? index;
    while (anchor < branch.length) {
      const candidate = branch[anchor];
      if (!candidate) break;
      if (candidate.type === "message" || candidate.type === "custom_message" || (candidate.type === "branch_summary" && candidate.summary)) break;
      anchor++;
    }
    return [{ index, anchor, entry: { entryId: entry.id, firstKeptEntryId: entry.firstKeptEntryId, beforeEntryId: branch[anchor]?.id ?? null, summary: entry.summary } }];
  });
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}
