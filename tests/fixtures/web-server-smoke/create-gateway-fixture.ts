import { WireError } from "../../../src/gateway/wire/create-error.ts";
import type { WebGatewayClient, WebObserverSink } from "../../../src/http/gateway-connection/client-types.ts";

export function createGatewayFixture() {
  const ENVIRONMENT = "alpha worker";
  interface FakeSession {
    readonly target?: string;
    readonly label: string;
    readonly cwd: string;
    readonly model?: string;
    readonly thinkingLevel?: string;
    readonly sessionId: string;
    readonly streamId: string;
    sequence: number;
    messages: readonly { role: "assistant"; content: readonly { type: "text"; text: string }[] }[];
    observationEnds: number;
    readonly sinks: Set<WebObserverSink>;
  }
  const sessions = new Map<string, FakeSession>();
  let created = 0;
  const record = {
    workbench: 0, create: [] as string[], state: [] as string[], stateAttempts: 0,
    send: [] as { sessionId: string; params: Record<string, unknown> }[],
    cancel: [] as { sessionId: string; operationId: string }[],
    observe: [] as string[], gatewayClose: 0, codeMode: 0,
  };
  const pendingFailure = new Map<string, WireError>();
  const failNext = (method: string, error: WireError): void => { pendingFailure.set(method, error); };
  let stateGate: { sessionId: string; wait: Promise<void>; release: () => void } | undefined;
  const holdNextState = (sessionId: string): (() => void) => {
    const { promise: wait, resolve: release } = Promise.withResolvers<void>();
    stateGate = { sessionId, wait, release };
    return release;
  };
  function takeFailure(method: string): void {
    const error = pendingFailure.get(method);
    if (!error) return;
    pendingFailure.delete(method);
    throw error;
  }
  function requireSession(sessionId: string): FakeSession {
    const session = sessions.get(sessionId);
    if (!session) throw new WireError("NOT_FOUND", "Session identity is not managed by this Gateway; no session was created.");
    return session;
  }
  const publicSession = (session: FakeSession) => ({
    label: session.label, sessionId: session.sessionId, state: "idle" as const,
    ...(session.target === undefined ? {} : { target: session.target }),
    cwd: session.cwd,
    ...(session.model === undefined ? {} : { model: session.model }),
    ...(session.thinkingLevel === undefined ? {} : { thinkingLevel: session.thinkingLevel }),
  });
  const snapshotOf = (session: FakeSession) => ({
    streamId: session.streamId, sessionId: session.sessionId, sequence: session.sequence,
    state: "idle" as const, messages: session.messages,
    kernel: { state: "not_started" as const },
    recentOperations: [],
  });
  const workbenchValue = () => ({
    targets: [{ id: ENVIRONMENT, label: "Alpha instance", local: true, python: "/usr/bin/python3", tags: [] }],
    sessions: [...sessions.values()].map(publicSession),
  });
  const unused = async (): Promise<never> => { throw new Error("Unexpected Gateway method in HTTP fixture."); };
  const gateway: WebGatewayClient = {
    async call(method, params) {
      switch (method) {
      case "workbench":
        takeFailure("workbench"); record.workbench += 1;
        return workbenchValue();
      case "createSession": {
        const { target, cwd = "/workspace" } = params as { target: string; cwd?: string };
        takeFailure("createSession"); record.create.push(target);
        if (target !== ENVIRONMENT) throw new WireError("NOT_FOUND", "Instance is not configured; no session was created.");
        created += 1;
        const session: FakeSession = {
          target, label: `新会话 ${created}`, cwd, sessionId: `sdk-session-${created}`,
          streamId: `fixture-stream-${created}`, sequence: created, messages: [], observationEnds: 0, sinks: new Set(),
        };
        sessions.set(session.sessionId, session);
        return { session: publicSession(session), snapshot: snapshotOf(session) };
      }
      case "getTarget":
        if (params.target !== ENVIRONMENT) throw new WireError("NOT_FOUND", "Instance is not configured.");
        return { id: ENVIRONMENT, label: "Alpha instance", local: true, python: "/usr/bin/python3", cwd: "/workspace", tags: [] };
      case "state": {
        const sessionId = params.sessionId as string;
        record.stateAttempts += 1; takeFailure("state"); record.state.push(sessionId);
        const snapshot = snapshotOf(requireSession(sessionId));
        const gate = stateGate?.sessionId === sessionId ? stateGate : undefined;
        stateGate = undefined;
        if (gate) await gate.wait;
        return snapshot;
      }
      case "send": {
        const { sessionId: identity, ...request } = params;
        const sessionId = identity as string;
        takeFailure("send");
        const session = requireSession(sessionId);
        record.send.push({ sessionId, params: request });
        return { accepted: true, requestId: request.requestId, operationId: `${sessionId}:1`, sessionId: session.sessionId };
      }
      case "cancel": {
        const { sessionId, operationId } = params as { sessionId: string; operationId: string };
        takeFailure("cancel"); requireSession(sessionId); record.cancel.push({ sessionId, operationId });
        return { operationId, status: "requested", droppedRequestIds: [], unknownRequestIds: [] };
      }
      case "kernelClear":
      case "kernelRestart":
      case "kernelVariables":
      case "kernelDeleteVariable":
      case "monitorFocus":
      case "monitorDiff":
      case "toolsList":
      case "toolsPromote":
      case "toolsDemote":
      case "toolsArchive":
      case "toolsRestore":
      case "toolsDelete":
        record.codeMode += 1; takeFailure("codeMode");
        throw new WireError("NOT_FOUND", "Kernel or tool is not available in this fixture.");
      default:
        return unused();
      }
    },
    observeSessions: unused,
    terminalSession: unused,
    downloadFile: unused,
    available: () => true,
    async observe(sessionId: string, sink: WebObserverSink) {
      takeFailure("observe");
      const session = requireSession(sessionId);
      record.observe.push(sessionId); session.sinks.add(sink); sink.snapshot(snapshotOf(session));
      return () => {
        if (!session.sinks.delete(sink)) return;
        session.observationEnds += 1; sink.end("Observation stopped by the web client.");
      };
    },
    async close(): Promise<void> { record.gatewayClose += 1; },
  };
  return { gateway, ENVIRONMENT, record, sessions, publicSession, requireSession, snapshotOf, workbenchValue, failNext, holdNextState };
}