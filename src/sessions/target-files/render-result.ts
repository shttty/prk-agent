import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
export const resultRenderer: Pick<ToolDefinition, "renderResult"> = {
  renderResult(result, { expanded, isPartial }, theme) {
    if (isPartial) return new Text(theme.fg("muted", "Working on target file…"), 0, 0);
    const details = result.details as { diff?: string } | undefined;
    const content = result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const output = expanded && details?.diff ? `${content}\n${details.diff}` : content;
    const lines = output.split("\n");
    return new Text(expanded || lines.length <= 12 ? output : `${lines.slice(0, 12).join("\n")}\n[Expand for more.]`, 0, 0);
  },
};
