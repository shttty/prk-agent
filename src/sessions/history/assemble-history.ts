import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { StoredSession, SessionRetarget, SessionReadIssue } from "./history-types.ts";
import { loadHistory } from "./catalog/load-history.ts";
import { cloneSession } from "./sdk-files/clone.ts";
import { list } from "./catalog/list.ts";
import { listAll } from "./catalog/list-visible.ts";
import { listArchived } from "./catalog/list-archived.ts";
import { get } from "./catalog/get.ts";
import { create } from "./sdk-files/create.ts";
import { rename } from "./metadata/rename.ts";
import { setSleeping } from "./metadata/set-sleeping.ts";
import { archive } from "./archive/archive.ts";
import { unarchive } from "./archive/unarchive.ts";
import { retarget } from "./binding/retarget.ts";
import { projectNamed } from "./metadata/find-project-by-name.ts";
import { assignProject } from "./metadata/assign-project.ts";
import { writeProject } from "./metadata/write-project.ts";
import { removeSessionFiles } from "./sdk-files/remove-session-files.ts";
import { readIssues } from "./diagnostics/read-issues.ts";

export async function createSessionHistory(options: { readonly cwd: string; readonly directory: string; readonly limits?: LimitsOptions }) {
  const ctx = await loadHistory(options);
  return {
    readIssues(): readonly SessionReadIssue[] {
      return readIssues(ctx);
    },
    clone: (sourceSessionId: string, label: string, entryId?: string): SessionManager => cloneSession(ctx, sourceSessionId, label, entryId),
    list(): readonly StoredSession[] {
      return list(ctx);
    },
    /** Visible sessions only; archived ones are listed by listArchived. */
    listAll(): readonly StoredSession[] {
      return listAll(ctx);
    },
    listArchived(): readonly StoredSession[] {
      return listArchived(ctx);
    },
    get(sessionId: string): StoredSession | undefined {
      return get(ctx, sessionId);
    },
    create(target: string, label: string, sessionCwd: string): SessionManager {
      return create(ctx, target, label, sessionCwd);
    },
    rename(sessionId: string, label: string): void {
      return rename(ctx, sessionId, label);
    },
    setSleeping(sessionId: string, sleeping: boolean): void {
      return setSleeping(ctx, sessionId, sleeping);
    },
    archive(sessionId: string, group: string, kernelOrphan: boolean): void {
      return archive(ctx, sessionId, group, kernelOrphan);
    },
    unarchive(sessionId: string): void {
      return unarchive(ctx, sessionId);
    },
    retarget(sessionId: string, selection: SessionRetarget): void {
      return retarget(ctx, sessionId, selection);
    },
    /** The project currently using this exact name, including archived sessions. */
    projectNamed(name: string): { id: string; name: string } | undefined {
      return projectNamed(ctx, name);
    },
    assignProject(sessionId: string, project: { readonly id: string; readonly name: string } | null): StoredSession {
      return assignProject(ctx, sessionId, project);
    },
    writeProject,
    /** Permanently remove the SDK files; the only operation that deletes history. */
    delete(sessionId: string): void {
      return removeSessionFiles(ctx, sessionId);
    },
  };
}
