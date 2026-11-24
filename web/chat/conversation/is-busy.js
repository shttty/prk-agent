export function isBusy(state) {
  const snapshot = state.session.snapshot;
  return Boolean(snapshot?.operation || snapshot?.state === "running" || snapshot?.state === "cancel_requested");
}
