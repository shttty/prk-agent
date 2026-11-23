import { delegationPolicy } from "./render-policy.ts";
import type { DelegationLevel } from "../../../config/session/delegation-levels.ts";
import type { SessionIdentity } from "../session-types.ts";

export function renderSessions(identity: SessionIdentity | undefined, delegation: DelegationLevel, callable: readonly string[]): string {
  return [
    ...(callable.includes("session_spawn") ? [
      "Other sessions run beside you. Each has its own context, model, kernel and tools; a child you spawn starts with none of your conversation, so its task must be self-contained.",
      "sessionId is the unique session identity for all session tools; sessionName is only its display label. Use session_list with a sessionId to inspect a controlled session's recent output when needed, not to poll for completion.",
      "You can message a child while it works, and it can message you. session_send delivery: steer lands at its next turn boundary, followUp after its whole run, abort interrupts it.",
      "A child finishes by session_result. Its result and any messages reach you through your inbox automatically; you are woken if idle. Never sleep or poll for them.",
      "A temporary child ends after delivering its result. A persistent child stays until you destroy it, so you can keep sending it follow-up work. Only the user can turn a child into an independent long-lived session; you may suggest it, not do it.",
      "You control your children and their descendants; the root session controls all.",
    ] : []),
    ...(identity ? [`You are a child session at depth ${identity.depth} (top level = 0), created by ${JSON.stringify(identity.parentLabel)} for one assigned task. Submit with session_result — plain replies are not delivered. Your parent can message, steer or abort you through your inbox.`] : []),
    ...(identity?.isolated ? [`You are running in an isolated git worktree at ${JSON.stringify(identity.cwd)}. Do not modify or run git writes against the parent checkout ${JSON.stringify(identity.repoRoot)}. session_result delivers your changes as a binary patch artifact.`] : []),
    ...(callable.includes("session_spawn") && !identity ? [delegationPolicy(delegation)] : []),
  ].join("\n");
}
