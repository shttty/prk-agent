export async function callConfig(ctx, id, route, body) {
  const { setSaving, setError, actions, setConfigs } = ctx;
  setSaving(true); setError("");
  try {
    const view = await actions.api.post(`/plugin-config/${route}`, body);
    setConfigs((all) => ({ ...all, [id]: view }));
    return view;
  } catch (cause) { setError(cause.message); return null; }
  finally { setSaving(false); }
}
