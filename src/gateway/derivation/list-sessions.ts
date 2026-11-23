import type { HostContext } from "../host/host-state.ts";
import type { SessionListRequest, SessionListRow, SessionObservation } from "../../plugins/sessions/session-types.ts";
import { readDerivedSession } from "../../sessions/derivation/read-derived-session.ts";
import { readSessionRecent } from "./read-session-recent.ts";
import { sessionRoleMarkers } from "./session-role-markers.ts";

export async function listSessions(ctx: HostContext, actor: string, request: SessionListRequest = {}): Promise<readonly SessionListRow[] | SessionObservation> {
  const acting = ctx.methods.storedSession(actor);
  if (request.sessionId === undefined) {
    return ctx.peerMessages.messaging.list().map((peer) => ({
      sessionId: peer.sessionId,
      sessionName: peer.label,
      state: peer.state,
      parentSessionId: peer.owner ?? null,
      ...(peer.pendingOwner === undefined ? {} : { pendingParentSessionId: peer.pendingOwner }),
      ...(peer.sessionId === acting.sessionId ? { self: true as const } : {}),
      ...sessionRoleMarkers(peer),
    }));
  }
  const selected = ctx.methods.storedSession(request.sessionId);
  if (selected.sessionId !== acting.sessionId && !ctx.methods.canControlSession(acting.sessionId, selected.sessionId)) {
    throw new Error("Session inspection requires control authority: self, an owner-chain ancestor, root, or this project's supervisor.");
  }
  const derived = readDerivedSession(selected.manager, ctx.derivation.derivationSchemas);
  const runtime = selected.sleeping ? undefined : ctx.host.collection.get(selected.sessionId);
  const snapshot = runtime?.session.sessionId === selected.sessionId ? runtime.host.getSnapshot() : ctx.methods.archivedSnapshot(selected);
  const streaming = runtime?.session.sessionId === selected.sessionId ? runtime.session.state.streamingMessage : undefined;
  const messages = runtime?.session.sessionId === selected.sessionId ? snapshot.messages : selected.manager.buildSessionContext().messages;
  return {
    sessionId: selected.sessionId,
    sessionName: selected.label,
    state: snapshot.state,
    parentSessionId: derived?.owner ?? null,
    ...(derived?.phase === undefined ? {} : { phase: derived.phase }),
    ...(derived?.role === undefined ? {} : { role: derived.role }),
    ...(derived?.result === undefined ? {} : { result: derived.result }),
    recent: readSessionRecent(streaming ? [...messages, streaming] : messages, Math.min(request.limit ?? 6, 20)),
  };
}
