import type { ToolCallPart } from "../../conversation/conversation-types.ts";
import type { KernelCellView } from "./kernel-cell/kernel-cell-presentation.ts";

/** A tool row's props once ToolPart has narrowed what assistant-ui passes through untyped. */
export type ToolRowProps = Pick<ToolCallPart, "toolCallId" | "toolName" | "title" | "argsText" | "result" | "artifact" | "isError" | "metadata" | "timing"> & {
  status?: { type: string };
  kernelCell?: KernelCellView | null;
};
