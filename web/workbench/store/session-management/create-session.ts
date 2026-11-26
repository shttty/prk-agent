import type { StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import type { CreateSessionOptions } from "./session-management-types.ts";
import type { RequestError } from "../requests/request-error.ts";
import { submitSessionCreation } from "./submit-session-creation.ts";

/** A new session on `targetName`; its interpreter is the instance's own, so only cwd/label/project ride along. Resolves with the row, a refusal that needs the dialog, or false. */
export async function createSession(ctx: StoreContext, targetName: string, options: CreateSessionOptions = {}): Promise<SessionRow | RequestError | false> {
  if (!targetName || ctx.state.pending.has("creating")) return false;
  const cwd = options.cwd?.trim() ?? "";
  const label = options.label?.trim() ?? "";
  const projectName = options.project?.name?.trim() ?? "";
  const projectId = options.project?.id?.trim() ?? "";
  const project = projectName ? { ...(projectId ? { id: projectId } : {}), name: projectName } : null;
  return submitSessionCreation(ctx, { target: targetName, ...(cwd ? { cwd } : {}), ...(label ? { label } : {}), ...(project ? { project } : {}) });
}
