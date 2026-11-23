import { setTimeout as sleep } from "node:timers/promises";

// Failure summaries only: never retain tool args, prompts, history text,
// successful tool output, provider configuration, or full tracebacks.
function safeError(value) {
  if (typeof value !== "string") return undefined;
  return value.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/, 1)[0]
    .replace(/https?:\/\/\S+/gi, "[URL omitted]")
    .replace(/(?:Bearer|Basic)\s+[^\s,;"']+/gi, "[authorization omitted]")
    .replace(/((?:token|api[-_ ]?key|authorization|password|secret)["']?\s*[:=]\s*)["']?[^\s,;}"']+/gi, "$1[REDACTED]")
    .replace(/\b(?:prompt|messages|history|content|code)["']?\s*[:=].*/gi, "[private payload omitted]")
    .replace(/\b[A-Za-z0-9_+\/=.-]{24,}\b/g, "[long value omitted]")
    .slice(0, 240);
}

function toolError(result) {
  const text = result?.content?.find((part) => part.type === "text")?.text;
  if (typeof text !== "string") return undefined;
  const line = text.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/).find((value) =>
    /^(?:[A-Za-z_]*(?:Error|Exception|Interrupt)\b|Python (?:execution|kernel|tool|target)\b|Worker (?:model|task|Python|ended)\b)/.test(value));
  return line ? safeError(line) : "[tool error text omitted]";
}

function toolSummary(details, operationId) {
  const result = details.result;
  return {
    operationId, tool: "python",
    isError: details.isError === true,
    outcome: ["ok", "error", "aborted", "unknown"].includes(result?.details?.outcome) ? result.details.outcome : undefined,
    error: details.isError ? toolError(result) : undefined,
  };
}
const completionSummary = (value) => value ? {
  operationId: value.operationId, status: value.status, error: safeError(value.error),
} : undefined;

/** Bounded last-failure observations for this live check, not another event/history store. */
export function observeLiveHost(host) {
  let python;
  let completion;
  const subscription = host.subscribe((event) => {
    const operationId = event.operationId ?? host.getSnapshot().operation?.operationId;
    const details = event.details;
    if (event.type === "operation_completed") completion = completionSummary(details);
    if (event.type === "session_event" && details?.sdkType === "tool_execution_start" && details.toolName === "kernel_code") python = { operationId, tool: "python" };
    if (event.type === "state_changed" && ["ok", "error", "aborted", "unknown"].includes(details?.kernel?.lastOutcome)) {
      python = { ...(python?.operationId === operationId ? python : {}), operationId, tool: "python", outcome: details.kernel.lastOutcome };
    }
    if (event.type === "session_event" && details?.sdkType === "tool_execution_end") {
      if (details.toolName === "kernel_code") {
        const summary = toolSummary(details, operationId);
        python = { ...summary, outcome: summary.outcome ?? (python?.operationId === operationId ? python.outcome : undefined) };
      }
    }
  });

  function failure(cause, operationId, terminal) {
    if (cause?.name === "HostLiveCheckError" && cause.diagnostics) return cause;
    const snapshot = host.getSnapshot();
    const model = snapshot.messages.findLast((message) => message.role === "assistant");
    const currentId = operationId ?? snapshot.operation?.operationId ?? completion?.operationId;
    const recent = snapshot.recentOperations.findLast((result) => !currentId || result.operationId === currentId);
    const diagnostics = {
      operationId: currentId, state: snapshot.state,
      model: model ? { stopReason: model.stopReason, error: safeError(model.errorMessage) } : undefined,
      python: python?.operationId === currentId ? python : undefined,
      completion: completionSummary(terminal ?? recent ?? (completion?.operationId === currentId ? completion : undefined)),
    };
    const error = new Error(`${safeError(cause instanceof Error ? cause.message : cause)}; host diagnostics=${JSON.stringify(diagnostics)}`);
    error.name = "HostLiveCheckError";
    error.diagnostics = diagnostics;
    return error;
  }

  async function waitForMarker(submission, predicate, timeoutMs = 180_000, pollMs = 50) {
    if (!submission.accepted) throw failure("Host rejected submission", submission.operationId);
    let terminal;
    const settled = submission.completion.then((value) => { terminal = value; }, (error) => {
      terminal = { operationId: submission.operationId, status: "rejected", error: error.message };
    });
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(failure("Timed out waiting for actual kernel side effect", submission.operationId, terminal)), timeoutMs);
    });
    const waiting = (async () => {
      while (!controller.signal.aborted) {
        if (await predicate()) return;
        if (terminal) throw failure("Terminal host outcome before expected kernel marker", submission.operationId, terminal);
        await Promise.race([sleep(pollMs, undefined, { signal: controller.signal }), settled]);
      }
    })();
    try { await Promise.race([waiting, deadline]); }
    finally { clearTimeout(timer); controller.abort(); }
  }

  return { waitForMarker, failure, close: () => subscription.unsubscribe() };
}
