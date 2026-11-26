import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { isPayload } from "../../payload/is-payload.ts";
import type { ToolCallPart } from "../../conversation/conversation-types.ts";
import { KernelCellPart } from "./kernel-cell/KernelCellPart.tsx";
import { ToolRow } from "./ToolRow.tsx";
import type { ToolRowProps } from "./tool-row-types.ts";

// assistant-ui passes the projected part through with `result`/`artifact` untyped and `title`/`metadata` unlisted.
type ToolPartProps = ToolCallMessagePartProps & Partial<Pick<ToolCallPart, "title" | "metadata">>;

export function ToolPart(props: ToolPartProps) {
  const { toolCallId, toolName, title, argsText, isError, status, timing } = props;
  const artifact = isPayload(props.artifact) && typeof props.artifact.output === "string"
    ? { output: props.artifact.output, running: props.artifact.running === true, unknown: props.artifact.unknown === true } : undefined;
  const row: ToolRowProps = { toolCallId, toolName, title, argsText, isError, status, timing, artifact, metadata: props.metadata ?? {}, result: isPayload(props.result) ? props.result : undefined };
  return toolName === "kernel_code" ? <KernelCellPart {...row} Row={ToolRow} /> : <ToolRow {...row} />;
}
