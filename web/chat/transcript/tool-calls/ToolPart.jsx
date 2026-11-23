import { KernelCellPart } from "./kernel-cell/KernelCellPart.jsx";
import { ToolRow } from "./ToolRow.jsx";

export function ToolPart(props) {
  return props.toolName === "kernel_code" ? <KernelCellPart {...props} Row={ToolRow} /> : <ToolRow {...props} />;
}
