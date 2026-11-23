export function warning(ctx, member) {
  if (ctx.warned.has(member)) return;
  ctx.warned.add(member);
  const label = member.startsWith("pi.registerCommand") ? "unsupported remote capability" : "远程插件调用了不支持的 UI (unsupported)";
  console.error(`[remote-extension host] ${label}: ${member}`);
}
