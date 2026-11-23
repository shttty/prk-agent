export function withLock(_ctx, projectSettings, scope, fn) {
  fn(scope === "project" ? projectSettings : "{}");
}
