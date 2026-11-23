import { join } from "node:path";
import { EventEmitter } from "node:events";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { workspace } from "../../../src/gateway/workspace/execute-workspace-request.ts";
import { createNativeInteractionService } from "../../../src/sessions/native-interaction/assemble-native-interaction.ts";
import { connectWebGateway } from "../../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../../src/http/listener/start-listener.ts";
import { WireError } from "../../../src/gateway/wire/create-error.ts";

/** Candidate composition only: production socket, HTTP, workspace and native handlers remain unchanged. */
export async function createGateway(fixture, files) {
  const manager = SessionManager.inMemory(fixture.root);
  const sessionId = manager.getSessionId();
  const events = new EventEmitter();
  let current = { target: "owned", sessionId, cwd: fixture.root };
  const context = (id) => {
    if (id !== sessionId) throw new WireError("NOT_FOUND", "Unknown owned session.");
    return { ...current };
  };
  const ctx = { workspace: { files }, methods: { storedSession: context, workspaceContext: context, runtimeChange: (run) => run() } };
  const native = createNativeInteractionService();
  const target = (id) => {
    const selected = context(id);
    return { ...selected, streamId: "owned-S2", state: "sleeping", readOnly: false, manager,
      referenceCandidates: (token) => files.referenceCandidates(selected, token),
      readReference: (path) => files.readReference(selected, path),
    };
  };
  const host = {
    subscribeSessions(listener) { events.on("collection", listener); return () => events.off("collection", listener); },
    workspace: (method, id, params) => workspace(ctx, method, id, params),
    nativeAction: (id, params) => native.action(target(id), params),
    browseTarget: ({ connection, path }) => {
      if (connection.target !== current.target) throw new WireError("INVALID_REQUEST", "Browse target does not match the owned target.");
      return files.browse(context(sessionId), path);
    },
    close: async () => { events.emit("collection", { type: "session_closed", sessionId }); await fixture.close(); },
  };
  const socket = join(fixture.localRoot, "gateway.sock");
  const listener = await startGateway(host, socket);
  const adapter = await connectWebGateway({ socket });
  const web = await startWebServer(adapter, { port: 0 });
  return { url: web.url, socket, sessionId, context: () => context(sessionId),
    retarget: (selection) => { current = { ...current, ...selection, sessionId }; events.emit("collection", { type: "session_control_changed", sessionId, details: { ...current } }); },
    async close() { await web.close(); await adapter.close(); await listener.close(); },
  };
}
