// Mock data + stateful routes for the session-messaging web UI (roles, relations, transfer, session_* tool rows).
// `install(page)` answers /api/workbench (roles included), /api/session-control/(root|supervisor) and /api/sessions/<name>/manage from
// one in-memory state, so reloads show what was saved. Used by tests/web/check-session-messaging-ui.mjs.
import { snapshotOf } from "./workspace-mock/session-snapshots.mjs";

export const TARGETS = [
  { id: "alpha", label: "Alpha", local: true, python: "/usr/bin/python3", cwd: "/data", tags: [] },
  { id: "beta", label: "Beta", local: false, python: "/usr/bin/python3", cwd: "/data", tags: [] },
];
const base = { state: "idle", target: "alpha", cwd: "/data" };
const project = { projectId: "p1", projectName: "Atlas" };
export const initialSessions = () => [
  { ...base, ...project, label: "Lead", sessionId: "s1" },
  { ...base, ...project, label: "Second", sessionId: "s4" },
  { ...base, ...project, label: "Bench", sessionId: "s5", derivation: { owner: "s1", createdBy: "s1", phase: "working", lifecycle: "persistent" } },
  { ...base, ...project, label: "Logs", sessionId: "s6", derivation: { owner: "s1", createdBy: "s1", pendingOwner: "s4", phase: "working", lifecycle: "temporary" } },
  { ...base, label: "Remote", sessionId: "s7", target: "beta" },
];

const now = Date.now();
const legacyListRows = [
  { name: "s1", worker: "w1", label: "Lead", capability: "worker", state: "idle", owner: null, root: true, supervisor: true, projectId: "p1" },
  { name: "s4", worker: "w2", label: "Second", capability: "worker", state: "idle", owner: null, root: false, supervisor: false, projectId: "p1" },
  { name: "s6", worker: "k2", label: "Logs", capability: "worker", state: "running", owner: "w1", createdBy: "w1", pendingOwner: "w2", root: false, supervisor: false, projectId: "p1", derivation: { lifecycle: "temporary" } },
  { name: "s7", worker: "r1", label: "Remote", capability: "worker", state: "sleeping", owner: null, root: false, supervisor: false },
];
const listRows = [
  { sessionId: "s1", sessionName: "Lead", state: "idle", parentSessionId: null, root: true, supervisor: true },
  { sessionId: "s4", sessionName: "Second", state: "idle", parentSessionId: null },
  { sessionId: "s6", sessionName: "Logs", state: "running", parentSessionId: "s1", pendingParentSessionId: "s4" },
  { sessionId: "s7", sessionName: "Remote", state: "sleeping", parentSessionId: null },
];
const observation = { sessionId: "s6", sessionName: "Logs", state: "running", parentSessionId: "s1", phase: "working", recent: [
  { role: "assistant", text: "LIVE_OBSERVATION_UI_7319" },
  { role: "toolResult", toolName: "kernel_code", text: "OBSERVATION_TOOL_RESULT", isError: false },
] };
const sendArgs = { to: "s1", message: "Bench numbers ready\nsee table", delivery: "steer" };
// k1's transcript: a resident session_send, a tool_search, and the deferred session_list reached through tool_call.
export const childMessages = [
  { role: "user", content: [{ type: "text", text: "report back" }], timestamp: now - 60_000 },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 50_000, content: [{ type: "toolCall", id: "q1", name: "tool_search", arguments: { query: "session list" } }] },
  { role: "toolResult", toolCallId: "q1", toolName: "tool_search", content: [{ type: "text", text: "session_list, session_manage" }], isError: false, timestamp: now - 49_000 },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 48_000, content: [{ type: "toolCall", id: "l1", name: "tool_call", arguments: { name: "session_list", args: {} } }] },
  { role: "toolResult", toolCallId: "l1", toolName: "tool_call", content: [{ type: "text", text: JSON.stringify(listRows) }], details: listRows, isError: false, timestamp: now - 47_000,
    nestedCalls: { complete: true, calls: [{ id: "l1/1", name: "session_list", status: "ok", arguments: {} }] } },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 46_900, content: [{ type: "toolCall", id: "legacy-list", name: "tool_call", arguments: { name: "session_list", args: {} } }] },
  { role: "toolResult", toolCallId: "legacy-list", toolName: "tool_call", content: [{ type: "text", text: JSON.stringify(legacyListRows) }], details: legacyListRows, isError: false, timestamp: now - 46_800,
    nestedCalls: { complete: true, calls: [{ id: "legacy-list/1", name: "session_list", status: "ok", arguments: {} }] } },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 46_700, content: [{ type: "toolCall", id: "observe-list", name: "tool_call", arguments: { name: "session_list", args: { sessionId: "s6", limit: 2 } } }] },
  { role: "toolResult", toolCallId: "observe-list", toolName: "tool_call", content: [{ type: "text", text: JSON.stringify(observation) }], details: observation, isError: false, timestamp: now - 46_600,
    nestedCalls: { complete: true, calls: [{ id: "observe-list/1", name: "session_list", status: "ok", arguments: { sessionId: "s6", limit: 2 } }] } },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 46_000, content: [{ type: "toolCall", id: "m1", name: "session_send", arguments: sendArgs }] },
  { role: "toolResult", toolCallId: "m1", toolName: "session_send", content: [{ type: "text", text: "{\"accepted\":true}" }], details: { id: "msg-1", to: "s1", accepted: true, pending: false, delivery: "delivered", expectReply: false }, isError: false, timestamp: now - 45_000 },
  { role: "assistant", stopReason: "stop", timestamp: now - 44_000, content: [{ type: "text", text: "sent" }] },
];

export function snapshotsFor(workers) {
  return Object.fromEntries(workers.map((worker) => [worker.sessionId, worker.sessionId === "s5"
    ? { ...snapshotOf(worker.sessionId, worker.state), messages: childMessages, messageEntryIds: childMessages.map((_, index) => `e${index}`) }
    : snapshotOf(worker.sessionId, worker.state)]));
}

export function createSessionMessagingState() {
  return { sessions: initialSessions(), control: { rootSessionId: "s1", supervisors: { p1: "s1" } }, posts: [] };
}

export async function install(page, state) {
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const workbench = () => ({ targets: TARGETS, sessions: state.sessions, archive: [], sessionControl: state.control });
  await page.route("**/api/workbench", (route) => json(route, workbench()));
  await page.route("**/api/session-control**", (route) => {
    const request = route.request();
    const role = /\/session-control\/(root|supervisor)$/.exec(new URL(request.url()).pathname)?.[1];
    if (!role) return json(route, { error: "Endpoint not found." }, 404);
    const body = request.postDataJSON();
    state.posts.push({ path: `/session-control/${role}`, body });
    const worker = state.sessions.find((entry) => entry.sessionId === body.sessionId);
    if (role === "root") state.control = { ...state.control, rootSessionId: worker.sessionId };
    else state.control = { ...state.control, supervisors: { ...state.control.supervisors, [worker.projectId]: worker.sessionId } };
    return json(route, state.control);
  });
  await page.route(/\/api\/sessions\/[^/]+\/manage$/, (route) => {
    const name = decodeURIComponent(/sessions\/([^/]+)\/manage/.exec(route.request().url())[1]);
    const body = route.request().postDataJSON();
    state.posts.push({ path: `/sessions/${name}/manage`, body });
    state.sessions = state.sessions.map((worker) => {
      if (worker.sessionId !== name || body.action !== "transfer") return worker;
      const { pendingOwner: _pending, ...derivation } = worker.derivation;
      return { ...worker, derivation: { ...derivation, owner: body.owner } };
    });
    return json(route, { ok: true });
  });
}
