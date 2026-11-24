import { DEFAULT_SESSION_OPTIONS } from "../../config/session/session-options.ts";
import type { HostContext, SessionHost, SessionHostOptions } from "./host-types.ts";
import { createSessionStreamId } from "./create-stream-id.ts";
import { snapshot } from "./snapshots/get-snapshot.ts";
import { receivePeer } from "./inbox/receive-peer.ts";
import { flushPeerInbox } from "./inbox/flush-peer-inbox.ts";
import { submit } from "./input/submit-input.ts";
import { compact } from "./operations/compact.ts";
import { cancel } from "./operations/cancel.ts";
import { interruptCell } from "./operations/interrupt-cell.ts";
import { dequeue } from "./operations/dequeue.ts";
import { reload } from "./lifecycle/reload.ts";
import { close } from "./lifecycle/close.ts";
import { isIdle } from "./operations/is-idle.ts";
import { extensionUiAction } from "./extensions/act-extension-ui.ts";
import { subscribe } from "./subscriptions/subscribe.ts";
import { observeExtensionUi } from "./subscriptions/observe-extension-ui.ts";
import { observeSdkEvents } from "./sdk-events/observe-sdk-events.ts";
import { observeKernel } from "./subscriptions/observe-kernel.ts";
import { emit } from "./subscriptions/publish-event.ts";

/** Correlates local request IDs with one transient SDK operation; it never persists or replays input. */
export function createSessionHost(options: SessionHostOptions): SessionHost {
  const { session, kernel } = options;
  const sessionOptions = options.sessionOptions ?? DEFAULT_SESSION_OPTIONS;
  const sessionId = session.sessionId;
  const streamId = createSessionStreamId();
  const ctx: HostContext = {
    options, session, kernel, sessionOptions, sessionId, streamId,
    listeners: new Set(),
    lifecycleTasks: new Set(),
    sequence: 0,
    state: "idle",
    active: undefined,
    recent: [],
    closing: false,
    closed: false,
    reloading: false,
    closePromise: undefined,
    dispatching: false,
    deliveries: [],
    inbox: [],
    inboxChars: 0,
    peerArrival: 0,
    flushingInbox: undefined,
    discarded: new Map(),
  };
  ctx.unsubscribeExtensionUi = options.extensionUi?.subscribe(() => observeExtensionUi(ctx)) ?? (() => {});
  ctx.unsubscribeSession = session.subscribe((event) => observeSdkEvents(ctx, event));
  ctx.lastNamespace = undefined;
  ctx.unsubscribeKernel = kernel?.subscribe((snapshot) => observeKernel(ctx, snapshot)) ?? (() => { });
  ctx.unsubscribeTerminals = options.terminals?.subscribeState((terminals) => emit(ctx, "state_changed", { details: { terminals } })) ?? (() => {});
  return {
    sessionId,
    get isIdle() { return isIdle(ctx); },
    hasInFlightCell: () => ctx.kernel?.hasInFlightCell?.() ?? false,
    get startedAt() { return ctx.active?.startedAt; },
    get operationKind() { return ctx.active?.kind; },
    streamId,
    get state() { return ctx.state; },
    getSnapshot: (includeMessages) => snapshot(ctx, includeMessages),
    ...(options.extensionUi ? { extensionUiAction: (args: Record<string, unknown>) => extensionUiAction(ctx, args) } : {}),
    submit: (request) => submit(ctx, request),
    compact: (requestId, instructions) => compact(ctx, requestId, instructions),
    receivePeer: (message, delivery) => receivePeer(ctx, message, delivery),
    flushPeerInbox: () => flushPeerInbox(ctx),
    cancel: (request) => cancel(ctx, request),
    interruptCell: (request) => interruptCell(ctx, request),
    dequeue: () => dequeue(ctx),
    reload: () => reload(ctx),
    close: () => close(ctx),
    subscribe: (listener) => subscribe(ctx, listener),
  };
}
