import { contentText, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import type { PromptReport, RecordedRequest, RenderedSystem, RequestModel } from "./capture-types.ts";
import { diffRequests } from "./diff-requests.ts";
import { recordRequest, sameRequest } from "./record-request.ts";

export interface PromptCapture {
  /** The final `context_with_system` result of the turn about to be sent. */
  observeContext(messages: Parameters<typeof getCurrentSystemMessage>[0]): void;
  /** The `before_provider_request` payload of that turn. */
  observeRequest(payload: unknown, model: RequestModel | undefined): void;
  report(): PromptReport;
}

/** Keeps the last two distinct provider requests of one session runtime, in memory only. */
export function createPromptCapture(): PromptCapture {
  let rendered: RenderedSystem | undefined;
  let latest: RecordedRequest | undefined;
  let previous: RecordedRequest | undefined;
  return {
    observeContext(messages) {
      const system = getCurrentSystemMessage(messages);
      rendered = system && {
        text: getSystemMessageText(system), base: contentText(system.content),
        sections: Object.fromEntries(Object.entries(system.sections ?? {}).filter((entry): entry is [string, string] => entry[1] !== null)),
      };
    },
    observeRequest(payload, model) {
      const recorded = recordRequest(payload, model, rendered, new Date());
      if (latest && sameRequest(latest.digest, recorded.digest)) { latest.request.repeats++; return; }
      previous = latest;
      latest = recorded;
    },
    report: () => ({ latest: latest?.request ?? null, previousAt: previous?.request.at ?? null, diff: latest && previous ? diffRequests(previous, latest) : null }),
  };
}
