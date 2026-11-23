export function openConfig(ctx, item) {
  const { hidePeek, setConfig, setWritten, setError, callConfig } = ctx;
  hidePeek(); setConfig({ id: item.id, open: true }); setWritten(null); setError("");
  if (item.id !== "group:tools:package:<inline:terminals>") void callConfig(item.id, "get", { provider: item.name });
}
