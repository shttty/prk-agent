import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { PromptCapture } from "./create-prompt-capture.ts";

/**
 * Observes the turn's final prompt and the payload that goes to the provider. Registered after every other
 * extension so it sees their `context_with_system` edits; it returns nothing, so neither is changed.
 */
export function bindPromptCapture(capture: PromptCapture): ExtensionFactory {
  return (pi) => {
    pi.on("context_with_system", (event) => { capture.observeContext(event.messages); });
    pi.on("before_provider_request", (event, ctx) => { capture.observeRequest(event.payload, ctx.model); });
  };
}
