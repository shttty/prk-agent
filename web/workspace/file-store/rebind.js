// A real conflict on the old target means nothing here: `retargeted` is the one marker the editor shows.
/**
 * The session moved to another execution target (same sessionId). Requests still in flight are invalidated by the
 * epoch; documents read from the old target keep their text and dirty state but cannot be saved until reloaded.
 */
export function rebind(ctx, environment) {
  if (ctx.environment === environment) return;
  const first = ctx.environment === null;
  ctx.environment = environment;
  if (first) return;
  ++ctx.epoch;
  for (const file of [...ctx.files.values()]) {
    // Never read successfully: nothing of the old target to protect, open it on the new one.
    if (file.epoch === undefined) { void ctx.load(file.path); continue; }
    ctx.files.set(file.path, { ...file, loading: false, saving: false, conflict: false, retargeted: true });
  }
  ctx.emit();
}
