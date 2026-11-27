import type { HostContext } from "../host/host-state.ts";
import type { SpawnTaskRequest } from "../../plugins/sessions/session-types.ts";
import { selectDerivationModel } from "../../config/derivation/select-model.ts";
import { DEFAULT_DERIVATION_ROLE, DEFAULT_MAX_DERIVATION_DEPTH } from "../../config/derivation/derivation-types.ts";
import { randomUUID } from "node:crypto";
import { DERIVED_SESSION_TYPE } from "../../plugins/sessions/derivation-protocol.ts";
import { readSessionIdentity } from "./read-session-identity.ts";
import { createWorktree } from "./worktrees/create-worktree.ts";
import { readSpawnableRoles } from "./read-spawnable-roles.ts";

export async function spawnDerived(ctx: HostContext, parentSessionId: string, request: SpawnTaskRequest, context: string): Promise<{ sessionId: string; sessionName: string; taskId: string }> {
  const parent = ctx.host.collection.get(parentSessionId);
  if (!parent?.session.model) throw new Error("The creating session has no active model.");
  if (typeof request.label !== "string" || !request.label.trim()) throw new Error("A non-empty label is required for every child task.");
  const config = ctx.derivation.derivationConfig;
  const childDepth = (readSessionIdentity(ctx, parentSessionId)?.depth ?? 0) + 1;
  const maxDepth = config.maxDepth ?? DEFAULT_MAX_DERIVATION_DEPTH;
  if (childDepth > maxDepth) throw new Error(`Maximum derivation depth ${maxDepth} reached; child depth ${childDepth} is not allowed.`);
  const parentEntry = ctx.methods.storedSession(parentSessionId);
  const lifecycle = request.lifecycle ?? ctx.host.config.session.defaultDerivedLifecycle;
  const roleName = request.role ?? DEFAULT_DERIVATION_ROLE;
  if (!config.roles || !Object.hasOwn(config.roles, roleName)) {
    throw new Error(`Unknown configured role ${JSON.stringify(roleName)}. Role is not a task label; call space_status() for configured role names or omit role to use ${DEFAULT_DERIVATION_ROLE}.`);
  }
  const spawnable = readSpawnableRoles(ctx, parentSessionId).map(({ name }) => name);
  if (!spawnable.includes(roleName)) {
    throw new Error(spawnable.length === 0 ? "This role cannot spawn child sessions." : `This role may only spawn roles: ${spawnable.join(", ")}; requested ${JSON.stringify(roleName)}.`);
  }
  const role = config.roles[roleName];
  const chosen = selectDerivationModel(config, { ...request, lifecycle }, {
    model: parent.session.model, thinkingLevel: parent.session.thinkingLevel,
  }, parent.session.modelRuntime);
  const target = request.target ?? parentEntry.target;
  if (!target) throw new Error("Derived session creation requires a target; discover configured instances with space_status().");
  const baseCwd = request.cwd ?? (target === parentEntry.target ? parentEntry.cwd : ctx.instances.targets.find((entry) => entry.id === target)?.kernel.cwd);
  const isolated = request.isolated ?? role?.isolated ?? config.defaultIsolated ?? false;
  const toolMode = role?.toolMode ?? config.defaultToolMode ?? ctx.host.config.session.workerTools;
  // A child joins its creator's project; session_manage or the user can move it afterwards.
  const project = parentEntry.projectId !== undefined && parentEntry.projectName !== undefined ? { id: parentEntry.projectId, name: parentEntry.projectName } : null;
  const taskId = randomUUID();
  const created = await ctx.methods.createManagedSession({ target, cwd: baseCwd, label: request.label }, async (manager) => {
    const worktree = isolated ? await createWorktree(ctx, target, baseCwd!, manager.getSessionId()) : undefined;
    manager.appendCustomEntry("gateway-native-session-state", { version: 1, toolMode,
      kernelLanguage: parent.kernel.getSnapshot().language, ...(role?.capabilities ? { capabilities: role.capabilities } : {}) });
    if (project) manager.appendCustomEntry("gateway-session-project", { version: 1, project });
    manager.appendCustomEntry(DERIVED_SESSION_TYPE, {
      sessionId: manager.getSessionId(),
      createdBy: parentEntry.sessionId, owner: parentEntry.sessionId, taskId, task: request.task, context, lifecycle, phase: "working", startedAt: Date.now(),
      ...(request.outputSchema === undefined ? {} : { outputSchema: request.outputSchema }),
      role: roleName,
      model: `${chosen.model.provider}/${chosen.model.id}`, thinkingLevel: chosen.thinkingLevel,
      ...(chosen.instructions ? { instructions: chosen.instructions } : {}),
      ...(worktree ? { isolated: true, repoRoot: worktree.repoRoot, worktreeRoot: worktree.worktreeRoot, baseCommit: worktree.baseCommit, parentState: worktree.parentState } : {}),
    });
    manager.appendModelChange(chosen.model.provider, chosen.model.id);
    manager.appendThinkingLevelChange(chosen.thinkingLevel);
    return worktree?.cwd;
  });
  const admission = await ctx.methods.sessionHost(created.session.sessionId).submit({
    requestId: `derived-task:${taskId}`,
    message: `[来自创建者会话 ${parentEntry.sessionId} 的任务 / task=${taskId}]\n# Shared context\n${context}\n# Your assignment\n${request.task}\n${request.outputSchema === undefined ? "" : `# Required structured output\nSubmit session_result output matching this JSON Schema: ${JSON.stringify(request.outputSchema)}\n`}调用 session_result 提交明确结果。结论附 file:line；跑过的命令附命令与退出码。不要仅用普通回复宣告完成。`,
  });
  if (!admission.accepted) throw new Error(`Derived session ${created.session.sessionId} was created but task admission failed: ${admission.error}. Inspect this session; do not blindly spawn another.`);
  void admission.completion.then((completion) => {
    if (completion.status !== "completed") console.error(`[${new Date().toISOString()}] Derived task ${taskId} in ${created.session.sessionId} ended ${completion.status}; session retained. ${completion.error ?? ""}`);
  });
  return { sessionId: created.snapshot.sessionId, sessionName: created.session.label, taskId };
}
