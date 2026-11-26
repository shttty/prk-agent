export type ContextUsageFacts = { tokens?: number | null; contextWindow?: number; percent?: number | null };
export type SessionStats = {
  totalMessages?: number; messageCount?: number; userMessages?: number; assistantMessages?: number; toolCalls?: number;
  tokens?: { total?: number; input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  cost?: number;
  contextUsage?: ContextUsageFacts | null;
};
// [metric, term, value]
export type UsageRow = [string, string, string];
