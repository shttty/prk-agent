import { contentText, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import type { PromptDiff, PromptReport, RecordedRequest, RenderedSystem, RequestModel } from "./capture-types.ts";
import { diffRequests } from "./diff-requests.ts";
import { recordRequest } from "./record-request.ts";
import { sameRequest } from "./same-request.ts";

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
  let previousAt: string | null = null;
  let diff: PromptDiff | null = null;
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
      // Compared at once: only the newest request keeps its message bodies, for the next comparison.
      diff = latest ? diffRequests(latest, recorded) : null;
      previousAt = latest?.request.at ?? null;
      latest = recorded;
    },
    report: () => ({ latest: latest?.request ?? null, previousAt, diff }),
  };
}
