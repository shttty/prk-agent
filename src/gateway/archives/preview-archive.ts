import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import type { ArchivePreview } from "./archive-types.ts";
import type { ArchivePreviewSession } from "./archive-types.ts";
import { readSessionDerivation } from "../session-views/readability/read-session-derivation.ts";

export function archivePreview(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["archivePreview"]>[0]): ArchivePreview {
      ctx.methods.storedSession(sessionId);
      const selected = ctx.derivation.derivation.plan(sessionId);
      const describe = (sessionId: string, owner: string | null): ArchivePreviewSession => {
        const entry = ctx.methods.storedSession(sessionId);
        const snapshot = ctx.methods.managedSessionSnapshot(entry);
        const derived = readSessionDerivation(ctx, entry);
        return Object.freeze({
          sessionId, label: entry.label, state: snapshot.state, owner,
          ...(derived ? { lifecycle: derived.lifecycle, phase: derived.phase } : {}),
        });
      };
      return Object.freeze({
        root: sessionId,
        sessions: Object.freeze(selected.destroyed.map((node) => describe(node.sessionId, node.sessionId === sessionId ? null : node.owner))),
        retained: Object.freeze(selected.retained.map((node) => Object.freeze({ ...describe(node.sessionId, node.owner), createdBy: node.createdBy }))),
      });
    }
