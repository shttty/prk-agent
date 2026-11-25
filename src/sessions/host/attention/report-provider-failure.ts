import type { HostContext } from "../host-types.ts";
import { emit } from "../subscriptions/publish-event.ts";

const retryable = /overloaded|provider.?returned.?error|rate.?limit|too many requests|\b(?:429|5\d\d)\b|service.?unavailable|server.?error|internal.?error|network.?error|connection.?(?:error|refused|lost|reset)|websocket.?(?:closed|error)|other side closed|fetch failed|upstream.?connect|reset before headers|socket hang up|ended without|http2 request did not get a response|timed? out|timeout|terminated|retry delay/i;

export function reportProviderFailure(ctx: HostContext, reason: string): void {
  if (ctx.closing || ctx.retryGrace || ctx.stopped) return;
  const stop = () => {
    ctx.retryGrace = undefined;
    ctx.stopped = true;
    emit(ctx, "state_changed", { details: { attentionChanged: true } });
  };
  if (retryable.test(reason)) {
    ctx.retryGrace = setTimeout(stop, ctx.sessionOptions.providerRetryGraceMs);
    ctx.retryGrace.unref();
    emit(ctx, "state_changed", { details: { attentionChanged: true } });
  } else stop();
}
