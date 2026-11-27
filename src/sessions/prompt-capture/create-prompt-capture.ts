import { contentText, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import type { CapturedBody, PromptDiff, PromptReport, RecordedRequest, RenderedSystem, RequestModel } from "./capture-types.ts";
import { diffRequests } from "./diff-requests.ts";
import { recordRequest } from "./record-request.ts";
import { sameRequest } from "./same-request.ts";

export interface PromptCapture {
  /** The final `context_with_system` result of the turn about to be sent. */
  observeContext(messages: Parameters<typeof getCurrentSystemMessage>[0]): void;
  /** The `before_provider_request` payload of that turn. */
  observeRequest(payload: unknown, model: RequestModel | undefined): void;
  report(): PromptReport;
  /** The latest request's whole body (copy without base64 media); `null` before the first request. */
  body(): CapturedBody | null;
  /** How many requests have been seen, identical replays included. */
  requests(): number;
  /** Called with the new `requests()` after each request is recorded; returns the unsubscribe. */
  subscribe(listener: (requests: number) => void): () => void;
}

/** Keeps the latest provider request of one session runtime whole and, until the next one arrives, what its comparison needs; in memory only. */
export function createPromptCapture(): PromptCapture {
  let rendered: RenderedSystem | undefined;
  let latest: RecordedRequest | undefined;
  let previousAt: string | null = null;
  let diff: PromptDiff | null = null;
  let requests = 0;
  const listeners = new Set<(requests: number) => void>();
  return {
    observeContext(messages) {
      const system = getCurrentSystemMessage(messages);
      rendered = system && {
        text: getSystemMessageText(system), base: contentText(system.content),
        sections: Object.fromEntries(Object.entries(system.sections ?? {}).filter((entry): entry is [string, string] => entry[1] !== null)),
      };
    },
    observeRequest(payload, model) {
      const recorded = recordRequest(payload, model, rendered, new Date(), ++requests);
      if (latest && sameRequest(latest.digest, recorded.digest)) latest.request.repeats++;
      else {
        // Compared at once: the previous request is dropped whole, only the diff's text windows remain.
        diff = latest ? diffRequests(latest, recorded) : null;
        previousAt = latest?.request.at ?? null;
        latest = recorded;
      }
      for (const listener of listeners) listener(requests);
    },
    report: () => ({ latest: latest?.request ?? null, previousAt, diff }),
    body: () => latest ? { seq: latest.request.seq, at: latest.request.at, shape: latest.request.shape, payload: latest.payload } : null,
    requests: () => requests,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
