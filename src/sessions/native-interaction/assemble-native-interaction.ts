import { DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import { DEFAULT_SESSION_OPTIONS } from "../../config/session/session-options.ts";
import { DEFAULT_REFERENCES_OPTIONS } from "../../config/references/references-options.ts";
import type { NativeContext, NativeInteractionOptions, NativeInteractionService } from "./native-types.ts";
import { catalog } from "./catalog/get-catalog.ts";
import { action } from "./dispatch/dispatch-action.ts";
import { send } from "./input/deliver-input.ts";

export function createNativeInteractionService(options: NativeInteractionOptions = {}): NativeInteractionService {
  const limits = options.limits ?? DEFAULT_LIMITS_OPTIONS;
  const sessionOptions = options.sessionOptions ?? DEFAULT_SESSION_OPTIONS;
  const referencesOptions = options.referencesOptions ?? DEFAULT_REFERENCES_OPTIONS;
  const ctx: NativeContext = {
    options, limits, sessionOptions, referencesOptions,
    running: new Map(), activeRequests: new Set(),
  };
  return {
    catalog: (target) => catalog(ctx, target),
    action: (target, request) => action(ctx, target, request),
    send: (target, request, admit) => send(ctx, target, request, admit),
  };
}
