import { submitSessionCreation } from "./submit-session-creation.js";
import { isRecord } from "../../payloads/is-record.js";
/** A new session on `targetName`; its interpreter is the instance's own, so only cwd/label/project ride along. */
export async function createSession(ctx, targetName, options = {}) {
    if (!targetName || ctx.state.pending.has("creating")) return false;
    const cwd = typeof options?.cwd === "string" ? options.cwd.trim() : "";
    const label = typeof options?.label === "string" ? options.label.trim() : "";
    // `project`: an existing {id,name}, or {name} for a new project (the Gateway validates it before creating the session).
    const projectName = isRecord(options?.project) && typeof options.project.name === "string" ? options.project.name.trim() : "";
    const projectId = isRecord(options?.project) && typeof options.project.id === "string" ? options.project.id.trim() : "";
    const project = projectName ? { ...(projectId ? { id: projectId } : {}), name: projectName } : null;
    return submitSessionCreation(ctx, { target: targetName, ...(cwd ? { cwd } : {}), ...(label ? { label } : {}), ...(project ? { project } : {}) });
  }
