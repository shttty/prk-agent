import type { SessionsGateway } from "../../plugins/sessions/gateway-types.ts";
import type { HostContext } from "../host/host-state.ts";
import { readSessionIdentity } from "./read-session-identity.ts";
import { readSpaceStatus } from "./read-space-status.ts";
import { listSessions } from "./list-sessions.ts";

export function createSessionsPluginGateway(ctx: HostContext, sessionId?: string): SessionsGateway {
  const derivation = ctx.derivation.derivation;
  const requireSession = () => {
    if (sessionId === undefined) throw new Error("Session operations require a session context.");
    return sessionId;
  };
  return {
    schemas: ctx.derivation.derivationSchemas,
    sessionOptions: ctx.host.config.session,
    spaceStatus: (target) => readSpaceStatus(ctx, target),
    spawn: (request) => derivation.spawn(requireSession(), request),
    submit: (summary, artifacts, output) => derivation.submit(requireSession(), summary, artifacts, output),
    destroy: (child) => derivation.destroyByAgent(requireSession(), child),
    transfer: (child, to) => derivation.transfer(requireSession(), child, to),
    accept: (child) => derivation.acceptTransfer(requireSession(), child),
    setProject: (session, project) => ctx.methods.manageProject(requireSession(), session, project),
    setSupervisor: (session) => ctx.methods.setProjectSupervisor({ sessionId: session }, requireSession()),
    list: (request) => listSessions(ctx, requireSession(), request),
    send: (request) => ctx.peerMessages.messaging.send(requireSession(), request),
    identity: () => sessionId === undefined ? undefined : readSessionIdentity(ctx, sessionId),
  };
}
