import type { ProjectPayload } from "../sidebar/sidebar-types.ts";
import type { DialogRequest } from "./dialog-request-types.ts";

/** What the shell keeps of the open dialog: any kind, including those the session dialog does not draw. */
type OpenDialogState = { type: string; targetName: string | null; project?: ProjectPayload | null };

const PLAIN = ["project", "rename", "derivation", "archive", "retarget", "root", "supervisor"] as const;
const WITH_PROJECT = ["rename-project", "archive-project", "project-memory"] as const;

function oneOf<Kind extends string>(kinds: readonly Kind[], type: string): type is Kind {
  return kinds.some((kind) => kind === type);
}

/** The session dialog's request for the shell's open dialog, or null for kinds drawn elsewhere (details, tools, instance settings). */
export function dialogRequest(dialog: OpenDialogState | null): DialogRequest | null {
  if (!dialog) return null;
  const { type, project } = dialog;
  const target = dialog.targetName ? { targetName: dialog.targetName } : {};
  if (type === "create") return { type, ...target, ...(project ? { project } : {}) };
  if (oneOf(PLAIN, type)) return { type, ...target };
  if (oneOf(WITH_PROJECT, type) && project) return { type, ...target, project };
  return null;
}
