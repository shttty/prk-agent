import type { WorkspaceMethod } from "../requests/requests-types.ts";

export const fileMethods: Record<string, WorkspaceMethod> = { upload: "filesUpload", download: "filesDownload", list: "filesList", read: "filesRead", write: "filesWrite", create: "filesCreate", rename: "filesRename", copy: "filesCopy", delete: "filesDelete" };
