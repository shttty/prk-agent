import type { SessionHostEvent } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { safeText } from "../../payloads/safe-text.ts";

/**
 * Display-only ordering: a new segment starts whenever tool runs of the same operation began since the previous
 * delta, the delta switches between reply text and thinking, or a new thinking block begins, so live text, thinking and
 * tool rows interleave in arrival order until the authoritative snapshot replaces them.
 */
export function appendLiveText(ctx: StoreContext, event: SessionHostEvent) {
  const operationId = safeText(event.operationId) || "live";
  const toolsSoFar = [...ctx.state.session.toolRuns.values()].filter((run) => (safeText(run.operationId) || "live") === operationId).length;
  const segments = ctx.state.session.streams.get(operationId) ?? [];
  const last = segments.at(-1);
  const text = safeText(event.text);
  const contentIndex = event.details?.contentIndex;
  const kind: { part?: "thinking"; contentIndex?: number } = event.details?.part === "thinking"
    ? { part: "thinking", contentIndex: typeof contentIndex === "number" && Number.isSafeInteger(contentIndex) ? contentIndex : 0 }
    : {};
  const next = last && last.afterTools === toolsSoFar && last.part === kind.part && last.contentIndex === kind.contentIndex
    ? [...segments.slice(0, -1), { ...last, text: `${last.text}${text}` }]
    : [...segments, { afterTools: toolsSoFar, ...kind, text }];
  patchSession(ctx, { streams: new Map(ctx.state.session.streams).set(operationId, next) }, { displayOnly: true });
}
