/** The monitor sections left unfolded, from the shell's layout state (`monitorOpenBlocks`, a comma list shared by every session). */
export function openMonitorBlocks(layoutState: unknown): string[] {
  const blocks = typeof layoutState === "object" && layoutState !== null && "monitorOpenBlocks" in layoutState ? layoutState.monitorOpenBlocks : "";
  return typeof blocks === "string" ? blocks.split(",").filter(Boolean) : [];
}
