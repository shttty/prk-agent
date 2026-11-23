import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { FilesContext } from "./file-types.ts";
import { createRead } from "./create-read.ts";
import { createEdit } from "./create-edit.ts";
import { createWrite } from "./create-write.ts";
/** PRK-owned tools: all file access and replacement stays on the target machine. */
export function createTargetFileTools(lease: () => TargetLease, cwd: string): ToolDefinition[] {
  const ctx: FilesContext = { lease, cwd };
  return [createRead(ctx), createEdit(ctx), createWrite(ctx)];
}
