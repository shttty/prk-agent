import type { StoredSession } from "../../sessions/history/history-types.ts";
import type { TaskTiming } from "../../sessions/derivation/read-task-timing.ts";

export interface ArchivedSession extends Pick<StoredSession, "label" | "sessionId" | "projectId" | "projectName">, TaskTiming {
  /** Current derivation owner, inside or outside the group; unarchiving keeps it when that owner is still listed. */
  readonly owner: string | null;
  readonly lifecycle?: string;
  readonly kernelOrphan?: boolean;
  readonly target?: string;
}

export interface ArchiveGroup {
  readonly group: string;
  readonly label: string;
  readonly at: string;
  readonly sessions: readonly ArchivedSession[];
}

export interface ArchivePreviewSession extends Pick<ArchivedSession, "sessionId" | "label" | "owner"> {
  readonly state: string;
  readonly lifecycle?: string;
  readonly phase?: string;
}

export interface ArchivePreview {
  readonly root: string;
  readonly sessions: readonly ArchivePreviewSession[];
  readonly retained: readonly (ArchivePreviewSession & { readonly createdBy: string })[];
}

export interface ProjectArchivePreview {
  readonly projectId: string;
  readonly sessions: readonly ArchivePreviewSession[];
  readonly retained: ArchivePreview["retained"];
}

export interface ProjectArchiveResult {
  readonly projectId: string;
  readonly archived: readonly ArchivePreviewSession[];
  readonly unarchived: readonly ArchivePreviewSession[];
  readonly error?: { readonly code: string; readonly message: string };
}
