import { Value } from "typebox/value";
import type { KernelCell, KernelContext, KernelProcess } from "../kernel-state.ts";
import { gatewayRequest, describeRequest } from "./cell-callback-schema.ts";
import { kernelCapabilityRequest } from "./kernel-capability-schema.ts";
import { binRequest } from "../../codemode/binary-delivery/binary-request-schema.ts";
import { answerBinRequest } from "../../codemode/binary-delivery/answer-bin-request.ts";
import { isLibraryCallback } from "../../codemode/kernel-protocol/is-library-callback.ts";
import { sendReply } from "./send-reply.ts";
import { setBudget } from "../cell/set-budget.ts";
import { stop } from "../process/stop.ts";
import { recordCallback } from "./record-callback.ts";
import { askCellScope } from "./ask-cell-scope.ts";
import { ownsFrames } from "../cell/owns-frames.ts";
import type { CallbackChunk } from "./receive-callback-chunk.ts";

export async function answer(ctx: KernelContext, process: KernelProcess, cell: KernelCell, chunk: CallbackChunk, payload: unknown): Promise<void> {
  if (cell.callbackPending || !ownsRequest()) return;
  cell.callbackPending = true;
  try {
    const reply = chunk.error === undefined ? await call(ctx, process, cell, chunk.channel, payload, ownsRequest)
      : { ok: false, error: chunk.error };
    if (!ownsRequest()) return;
    await sendReply(ctx, process, cell, chunk.requestId, reply, {
      ownsRequest,
      finalWritten: (id) => { chunk.finalReplyId = id; },
    });
  } catch (error) {
    if (ownsRequest()) {
      void stop(ctx, process, { failure: error }).catch((cleanup) => { console.error("[kernel] Callback generation cleanup unconfirmed:", cleanup); });
    }
  } finally {
    if (cell.callbackChunk === chunk) {
      cell.callbackChunk = undefined;
      cell.callbackPending = false;
    }
  }

  function ownsRequest(): boolean {
    return cell.callbackChunk === chunk && !cell.callbacks.signal.aborted && ownsFrames(ctx, process, cell);
  }
}

async function call(ctx: KernelContext, process: KernelProcess, cell: KernelCell, channel: string, payload: unknown, ownsRequest: () => boolean) {
  const signal = cell.callbacks.signal;
  let reply: { ok: boolean; value?: unknown; error?: string };
  let callback: KernelCell["details"]["callbacks"][number] | undefined;
  let waiting = false;
  try {
    if (channel === "binary") {
      if (!Value.Check(binRequest, payload) || !ctx.hooks.binDir) throw new Error("Invalid or unconfigured tool_bin request.");
      reply = { ok: true, value: await answerBinRequest(ctx.hooks.binDir, payload) };
    } else {
      const sdk = cell.sdk;
      if (!sdk) throw new Error("Callbacks require the owning SDK tool context.");
      if (channel === "capability") {
        if (Buffer.byteLength(JSON.stringify(payload)) > 4096 || !Value.Check(kernelCapabilityRequest, payload)) throw new Error("Invalid kernel permission request.");
        if (!ctx.helperNames.includes(payload.name)) throw new Error(`No kernel function named ${JSON.stringify(payload.name)}.`);
        if (ctx.hooks.kernelCapabilities?.(payload.name) === false) throw new Error(`Kernel function ${JSON.stringify(payload.name)} is disabled for this session.`);
        reply = { ok: true };
      } else if (channel === "describe") {
        if (!Value.Check(describeRequest, payload)) throw new Error("Invalid Gateway describe request.");
        const tools = sdk.tools.filter((tool) => !isLibraryCallback(tool.name) && ctx.hooks.allowGatewayTool?.(tool.name) !== false);
        if (payload.name == null) reply = { ok: true, value: tools.map(({ name, description }) => ({ name, description })) };
        else {
          const tool = tools.find(({ name }) => name === payload.name);
          if (!tool) throw new Error(`No callable Gateway tool named ${JSON.stringify(payload.name)}; call gateway.describe() for the list.`);
          reply = { ok: true, value: { name: tool.name, description: tool.description, parameters: tool.parameters, ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}) } };
        }
      } else {
        if (!Value.Check(gatewayRequest, payload)) throw new Error("Invalid Gateway callback request.");
        if (isLibraryCallback(payload.name) !== (channel === "library")) throw new Error("Library callbacks are prelude-only.");
        if (channel !== "gateway" && channel !== "library") throw new Error("Unknown callback channel.");
        if (payload.result === "file" && (!['read', 'edit', 'write'].includes(payload.name) || Buffer.byteLength(JSON.stringify(payload)) > 1024 * 1024)) throw new Error("Invalid or oversized file callback.");
        if (payload.result === "file" && ctx.hooks.kernelCapabilities?.(payload.name) === false) throw new Error("Kernel file function is disabled.");
        if (!ownsRequest()) return { ok: false };
        callback = { name: payload.name, status: "error" };
        cell.pendingCallback = callback;
        recordCallback(cell, callback);
        signal.addEventListener("abort", discard, { once: true });
        if (payload.name === "ask") { setBudget(ctx, cell, true); waiting = true; }
        if (!ownsRequest()) return { ok: false };
        const execute = () => {
          signal.throwIfAborted();
          if (!ownsRequest()) throw new Error("Kernel callback owner changed.");
          return sdk.executeTool(payload.name, payload.args, { signal });
        };
        const invoke = () => cell.runCallback ? cell.runCallback(signal, execute) : execute();
        const outcome = await (waiting ? askCellScope.run({ kernelId: process.generation, cellId: cell.id }, invoke)
          : payload.result === "file" ? ctx.fileCallback.run(payload.name, invoke) : invoke());
        if (!ownsRequest()) return { ok: false };
        const text = outcome.result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
        if (payload.result === "file") {
          let found = false;
          const content = outcome.result.content.flatMap((part) => {
            if (payload.name !== "read" || outcome.isError || !ctx.hooks.fileReadNotice || part.type !== "text" || found || !part.text.startsWith(ctx.hooks.fileReadNotice)) return [part];
            found = true;
            const extra = part.text.slice(ctx.hooks.fileReadNotice.length).replace(/^\n/u, "");
            return extra ? [{ ...part, text: extra }] : [];
          });
          const value = { isError: outcome.isError, content, details: outcome.result.details, path: outcome.toolCall.arguments.path };
          if (Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) throw new Error("File result exceeds 256 KiB; writes may already have occurred.");
          reply = { ok: true, value };
        } else reply = outcome.isError ? { ok: false, error: text } : { ok: true, value: outcome.result.structuredContent === undefined ? text : outcome.result.structuredContent };
        if (ownsRequest()) callback.status = outcome.isError ? "error" : "ok";
      }
    }
  } catch (error) {
    try { reply = { ok: false, error: error instanceof Error ? error.message : String(error) }; }
    catch { reply = { ok: false, error: "Gateway callback failed." }; }
  } finally {
    signal.removeEventListener("abort", discard);
    if (cell.pendingCallback === callback) cell.pendingCallback = undefined;
    if (waiting && ownsRequest()) setBudget(ctx, cell, false);
  }
  return reply;

  function discard(): void {
    if (callback && cell.pendingCallback === callback) callback.status = "discarded";
  }
}
