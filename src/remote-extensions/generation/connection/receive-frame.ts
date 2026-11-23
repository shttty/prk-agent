import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { Value } from "typebox/value";
import { kernelMemory } from "../../../codemode/kernel-protocol/kernel-protocol-schema.ts";
import type { Frame, GenerationContext } from "../generation-types.ts";
import { decode } from "../../codec/decode.mjs";
import { encode } from "../../codec/encode.mjs";
import { errorOf } from "./normalize-error.ts";
import { send } from "./send-frame.ts";
import { publishMonitor } from "../telemetry/publish-monitor.ts";
import { forwardReverseUpdate } from "../callbacks/forward-reverse-update.ts";
import { recordProviderError } from "./record-provider-error.ts";

export async function receive(ctx: GenerationContext, frame: Frame): Promise<void> {
    if (ctx.failure) return;
    if (frame.kind === "provider_policy") {
      if (!ctx.registration) await ctx.startPromise;
      recordProviderError(ctx, decode(frame.payload));
      return;
    }
    if (frame.kind === "memory") {
      const memory = decode(frame.payload);
      if (!Value.Check(kernelMemory, memory)) throw new Error("Invalid remote host memory telemetry.");
      ctx.memory = memory;
      ctx.memoryAt = Date.now();
      publishMonitor(ctx, "running");
      return;
    }
    if (frame.kind === "reply" || frame.kind === "abort_ack") {
      clearTimeout(ctx.abortAcks.get(frame.id));
      ctx.abortAcks.delete(frame.id);
      if (frame.kind === "abort_ack") return;
    }
    if (frame.kind === "reply") {
      const pending = ctx.pending.get(frame.id);
      if (!pending) return;
      if (Object.hasOwn(frame, "error")) pending.reject(errorOf(decode(frame.error)));
      else pending.resolve(decode(frame.result));
    } else if (frame.kind === "update") {
      ctx.pending.get(frame.id)?.update?.(decode(frame.payload) as AgentToolResult<unknown>);
    } else if (frame.kind === "abort") {
      ctx.reverse.get(frame.id)?.abort(decode(frame.reason));
    } else if (frame.kind === "request") {
      const controller = new AbortController();
      ctx.reverse.set(frame.id, controller);
      const owner = ctx.pending.get(frame.parentId ?? "");
      let dialog = false;
      try {
        const payload = decode(frame.payload) as { name: string; method: string; args: unknown[] & Record<string, unknown>; aborted?: boolean };
        if (payload.aborted) controller.abort(new Error("Remote callback was already aborted."));
        const signal = owner?.signal ? AbortSignal.any([owner.signal, controller.signal]) : controller.signal;
        let result: unknown;
        if (frame.method === "ui") {
          const ui = ctx.context?.ui;
          if (!ui) throw new Error("Remote UI context is not bound or is stale.");
          const methods: Record<string, true> = { notify: true, setStatus: true, setWidget: true, setTitle: true, setEditorText: true, select: true, confirm: true, input: true, editor: true };
          if (!Object.hasOwn(methods, payload.method)) throw new Error(`Unsupported remote UI operation: ${payload.method}`);
          dialog = ["select", "confirm", "input", "editor"].includes(payload.method);
          if (dialog) owner?.userWait(true);
          const args = [...payload.args];
          if (["select", "confirm", "input"].includes(payload.method)) args[2] = { ...(args[2] as object | undefined), signal };
          const method = ui[payload.method as keyof typeof ui];
          if (typeof method !== "function") throw new Error(`Remote UI operation is not callable: ${payload.method}`);
          result = await Reflect.apply(method, ui, args);
        } else {
          if (frame.method !== "executeTool" || !owner?.ctx) throw new Error("Unsupported or stale remote reverse callback.");
          result = await owner.ctx.executeTool(payload.name, payload.args, {
            signal,
            onUpdate: (partial) => forwardReverseUpdate(ctx, frame.id, partial),
          });
        }
        await send(ctx, { kind: "reply", id: frame.id, result: encode(result) });
      } catch (error) {
        await send(ctx, { kind: "reply", id: frame.id, error: encode(errorOf(error)) });
      } finally {
        if (dialog) owner?.userWait(false);
        ctx.reverse.delete(frame.id);
      }
    }
}
