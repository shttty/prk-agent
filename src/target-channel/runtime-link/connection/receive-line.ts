import { Buffer } from "node:buffer";
import { stripVTControlCharacters } from "node:util";
import { assembleRuntimeSource, TARGET_CHANNEL_VERSION } from "../../deployment-source/assemble-runtime-source.ts";
import type { TargetEvent } from "../../channels/channel-types.ts";
import { errorOf } from "../../connection-error/normalize-error.ts";
import type { Reply, RuntimeLinkContext } from "../link-state.ts";
import { exit } from "./end-link.ts";

// Split the marker so a shell's echo of the bootstrap never looks like READY.
const READY = "@@PRK-" + "READY@@";

export function line(ctx: RuntimeLinkContext, text: string): void {
  if (ctx.exited !== undefined) return;
  if (ctx.stage === "ready") {
    if (stripVTControlCharacters(text).trim() === READY) {
      ctx.stage = "hello";
      try {
        const source = `${Buffer.from(assembleRuntimeSource(ctx.limits), "utf8").toString("base64")}\n`;
        if (Buffer.byteLength(source) > ctx.limits.maxFrameBytes) throw new Error("Target bootstrap exceeds frame limit");
        ctx.transport.write(source);
      }
      catch (error) { exit(ctx, errorOf(error).message); }
    }
    return;
  }
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) { if (ctx.stage === "run") exit(ctx, "Invalid process JSON frame"); return; }
  let value: unknown;
  try { value = JSON.parse(trimmed); } catch { exit(ctx, "Invalid process JSON frame"); return; }
  if (value === null || typeof value !== "object" || Array.isArray(value)) { exit(ctx, "Invalid process frame"); return; }
  const message = value as Reply;
  if (ctx.stage === "hello") {
    if (message.t !== "hello" || typeof message.version !== "number") return;
    if (message.version !== TARGET_CHANNEL_VERSION) {
      exit(ctx, `target channel version ${message.version} does not match ${TARGET_CHANNEL_VERSION}`);
      return;
    }
    ctx.stage = "run";
    clearTimeout(ctx.startTimer);
    ctx.handshake.resolve();
    return;
  }
  if (typeof message.re === "number") {
    if (!Number.isSafeInteger(message.re) || message.re < 0) { exit(ctx, "Invalid process reply id"); return; }
    ctx.window.confirm(message.re);
    const reply = ctx.replies.get(message.re);
    if (typeof message.error === "string") reply?.reject(Object.assign(new Error(message.error), typeof message.code === "string" ? { code: message.code } : {}));
    else reply?.resolve(message);
  } else if (typeof message.mod === "string" && typeof message.t === "string") {
    ctx.onEvent(message as TargetEvent);
  } else {
    exit(ctx, "Unsupported process frame");
  }
}
