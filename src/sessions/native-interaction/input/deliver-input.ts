import { object } from "../../../gateway/wire/is-record.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { ExtendedSendRequest, SendMode } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeInputAdmission, NativeTarget } from "../native-types.ts";
import { staticCommands } from "../catalog/command-metadata.ts";
import { catalog } from "../catalog/get-catalog.ts";
import { action } from "../dispatch/dispatch-action.ts";
import { actionFailure } from "../dispatch/action-failure.ts";
import { operationKey } from "../dispatch/identify-request.ts";
import { parseSlash } from "./parse-slash.ts";
import { actionArguments } from "./parse-command-arguments.ts";
import { prepareInput } from "./prepare-input.ts";
import { findCommand } from "../catalog/find-command.ts";

export async function send(ctx: NativeContext, target: NativeTarget, request: ExtendedSendRequest, admit?: NativeInputAdmission): Promise<unknown> {
  const { sessionOptions, limits, referencesOptions, activeRequests } = ctx;
  if (request.sessionId !== target.sessionId) throw new WireError("INVALID_REQUEST", "Send routing identity does not match the selected Gateway session.");
  const mode: SendMode = request.mode ?? sessionOptions.defaultSendMode;
  const parsed = mode === "auto" ? parseSlash(request.message) : { kind: "text" as const };
  const hasStructuredInput = (request.attachments?.length ?? 0) > 0 || (request.references?.length ?? 0) > 0;
  if (mode === "auto" && parsed.kind !== "text" && parsed.name === "new" && request.source === "web") {
    return { accepted: false, requestId: request.requestId, error: "Web does not execute /new; create a session or send it as plain text.", executed: false, ...(hasStructuredInput ? {} : { plainSendAvailable: true }) };
  }

  const submit = async (current: NativeTarget): Promise<unknown> => {
    const host = current.host;
    if (!host) throw new WireError("NOT_FOUND", "Session has read-only history but no active runtime; explicit execution recovery is required.");
    const requestKey = operationKey(current, request.requestId);
    if (activeRequests.has(requestKey)) return { accepted: false, requestId: request.requestId, error: "This send request is already active; input was not replayed.", active: true };
    activeRequests.add(requestKey);
    try {
      if (current.readOnly) {
        activeRequests.delete(requestKey);
        return { accepted: false, requestId: request.requestId, error: "Session is closed or read-only; input was not replayed." };
      }
      const prepared = await prepareInput(current, request, limits, referencesOptions);
      const submission = await host.submit({ requestId: request.requestId, message: prepared.message, ...(request.queue === undefined ? {} : { queue: request.queue }), images: prepared.images });
      if (submission.accepted) {
        void submission.completion.then(() => activeRequests.delete(requestKey), () => activeRequests.delete(requestKey));
      } else {
        activeRequests.delete(requestKey);
      }
      return submission;
    } catch (error) {
      activeRequests.delete(requestKey);
      throw error;
    }
  };

  const deliver = async (current: NativeTarget, admitSdk?: NativeInputAdmission): Promise<unknown> => {
    if (mode === "auto" && parsed.kind !== "text") {
      const commands = catalog(ctx, current).commands;
      const command = parsed.name === undefined ? undefined : commands.findLast((entry) => entry.name === parsed.name);
      if (parsed.kind === "unknown" || !parsed.name || !command) {
        const error = hasStructuredInput ? "Control input with attachments or references was rejected without decoding or execution." : `Unknown control input ${JSON.stringify(request.message)} was not executed; choose plain send to send it as ordinary text.`;
        return { accepted: false, requestId: request.requestId, error, executed: false, ...(hasStructuredInput ? {} : { plainSendAvailable: true }) };
      }
      const isStaticCommand = staticCommands.some((entry) => entry.name === command.name) && !current.session?.extensionRunner.getCommand(command.name);
      if (isStaticCommand && hasStructuredInput) return { accepted: false, requestId: request.requestId, error: "Control input cannot include attachments or references; nothing was decoded or executed." };
      if (isStaticCommand) {
        const nativeRequest = { sessionId: current.sessionId, requestId: request.requestId, action: parsed.name, args: actionArguments(parsed.name, parsed.args) };
        // Only this resolved builtin turns external message text into a session label.
        if (parsed.name === "name" && (!parsed.args || parsed.args.length > limits.labelChars || /\p{Cc}/u.test(parsed.args))) {
          return actionFailure(nativeRequest, new WireError("INVALID_REQUEST", `Session name must be 1–${limits.labelChars} characters without control characters.`));
        }
        const native = await (ctx.options.dispatchAction ? ctx.options.dispatchAction(nativeRequest) : action(ctx, current, nativeRequest));
        if (native.action === "compact" && native.status === "running" && object(native.data) && typeof native.data.operationId === "string") {
          return { accepted: true, requestId: native.requestId, operationId: native.data.operationId, sessionId: current.sessionId };
        }
        return native;
      }
      if (!command.availability.enabled) return { accepted: false, requestId: request.requestId, error: command.availability.reason ?? `/${command.name} is unavailable.`, executed: false };
    }
    return admitSdk ? admitSdk(submit) : submit(current);
  };

  // Known builtins use native action admission, which wakes only commands that need an active runtime.
  if (mode === "auto" && parsed.kind !== "text") {
    const command = parsed.name ? findCommand(target, parsed.name) : undefined;
    if (parsed.name === "new" || command?.source === "builtin") return deliver(target, admit);
  }
  return admit ? admit((current) => deliver(current)) : deliver(target);
}
