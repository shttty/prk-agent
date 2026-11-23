import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import type { HostContext } from "../../host/host-state.ts";
import { WireError } from "../../wire/create-error.ts";

export async function ensureRuntime(ctx: HostContext, sessionId: string): Promise<void> {
  const entry = ctx.methods.storedSession(sessionId);
  const target = ctx.instances.targets.find((candidate) => candidate.id === entry.target);
  const issue = target && configurationIssue(target);
  if (issue) throw new WireError("INVALID_REQUEST", issue.message, { submitted: false, configurationIssue: issue });
  if (entry.sleeping) return;
  const live = ctx.host.collection.snapshot().find((session) => session.sessionId === sessionId);
  const runtime = ctx.host.collection.get(sessionId);
  const rebuild = live?.state === "idle" && runtime !== undefined && ctx.methods.kernelUnusable(runtime);
  if (live && live.state !== "closed" && !rebuild) return;
  // Either way the message is not admitted; say so explicitly (details.submitted) so the client does not guess.
  let reason: string;
  try {
   const resumed = await ctx.methods.autoRecover(sessionId);
   if (resumed.session.recovery?.status === "new") return;
   reason = resumed.session.recovery?.message ?? "";
  } catch (error) {
   reason = error instanceof Error ? error.message : String(error);
  }
  throw new WireError("UNAVAILABLE", `No kernel could be started; this input was not submitted. ${reason}`.trim(), { submitted: false, stage: "kernel", reason });
 }
