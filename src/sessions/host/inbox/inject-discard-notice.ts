import type { HostContext } from "../host-types.ts";

export async function injectDiscardNotice(ctx: HostContext): Promise<void> {
  if (!ctx.discarded.size) return;
  const entries = [...ctx.discarded.values()];
  const lines = ["Previous run was aborted or peer delivery was refused. Discarded messages were not replayed."];
  for (const [disposition, heading] of [["never-delivered", "Never delivered"], ["delivered-but-unprocessed", "Delivered but unprocessed"]] as const) {
    lines.push(`${heading}:`);
    const group = entries.filter((entry) => entry.disposition === disposition);
    if (!group.length) lines.push("(none)");
    for (const entry of group) lines.push(`- sender=${entry.sender} message=${entry.messageId} reason=${entry.reason}`);
  }
  lines.push("Confirm with the senders if needed; do not assume discarded messages were processed.");
  await ctx.session.sendCustomMessage({ customType: "gateway-peer-discard-notice", display: false, content: lines.join("\n"), details: { entries } }, { triggerTurn: false });
  for (const entry of entries) ctx.discarded.delete(entry.messageId);
}
