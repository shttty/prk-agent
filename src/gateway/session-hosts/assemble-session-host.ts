import type { SessionHost } from "../../sessions/host/host-types.ts";
import type { HostContext } from "../host/host-state.ts";
import type { HostBindingContext } from "./host-binding-state.ts";
import { dispose } from "./binding/dispose-host-binding.ts";
import { fence } from "./binding/fence-host-binding.ts";
import { isIdle } from "./binding/is-host-idle.ts";
import { refresh } from "./binding/refresh-host-binding.ts";
import { extensionUiAction } from "./execute-extension-ui.ts";
import { requireSource } from "./binding/require-active-source.ts";
import { cancel } from "./input/cancel-operation.ts";
import { interruptCell } from "./input/interrupt-cell.ts";
import { dequeue } from "./input/dequeue-input.ts";
import { flushPeerInbox } from "./input/flush-peer-inbox.ts";
import { receivePeer } from "./input/receive-peer.ts";
import { submit } from "./input/submit-input.ts";
import { close } from "./lifecycle/close-session.ts";
import { reload } from "./lifecycle/reload-session.ts";
import { snapshot } from "./subscription/read-host-snapshot.ts";
import { subscribe } from "./subscription/subscribe-host.ts";

export function assembleSessionHost(parent: HostContext, sessionId: string): SessionHost {
  const ctx: HostBindingContext = {
    sessionId,
    parent,
    subscribers: new Set(),
    source: undefined,
    unsubscribe: undefined,
    original: undefined,
    fenced: undefined,
    binding: {
      refresh: (publishSnapshot = false) => refresh(ctx, publishSnapshot),
      fence: () => fence(ctx),
      dispose: () => dispose(ctx),
    },
  };
  const wrapped: SessionHost = {
    sessionId,
    get isIdle() { return isIdle(ctx); },
    hasInFlightCell: () => { ctx.binding.refresh(); return ctx.source?.hasInFlightCell?.() ?? false; },
    get startedAt() { ctx.binding.refresh(); return ctx.source?.startedAt; },
    get streamId() { return ctx.source?.streamId ?? parent.methods.archivedStream(parent.methods.storedSession(sessionId)).streamId; },
    get state() { return ctx.source?.state ?? parent.methods.archivedStream(parent.methods.storedSession(sessionId)).state; },
    getSnapshot: () => snapshot(ctx),
    extensionUiAction: (args) => extensionUiAction(ctx, args),
    subscribe: (listener) => subscribe(ctx, listener),
    submit: (request) => submit(ctx, request),
    compact: (requestId, instructions) => requireSource(ctx).compact(requestId, instructions),
    receivePeer: (message, delivery) => receivePeer(ctx, message, delivery),
    flushPeerInbox: () => flushPeerInbox(ctx),
    cancel: (request) => cancel(ctx, request),
    interruptCell: (request) => interruptCell(ctx, request),
    dequeue: () => dequeue(ctx),
    reload: () => reload(ctx),
    close: () => close(ctx),
  };
  parent.sessionHosts.hosts.set(sessionId, wrapped);
  parent.sessionHosts.hostBindings.set(sessionId, ctx.binding);
  ctx.binding.refresh();
  return wrapped;
}
