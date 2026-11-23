export function noop(ctx, owner, member, result, ..._args) {
  ctx.assertLive(owner);
  ctx.warning(`ui.${member}`);
  return typeof result === "function" ? result() : result;
}

export function emptyListener() { return () => {}; }
export function emptyDialog() { return Promise.resolve(undefined); }
export function emptyThemes() { return []; }
export function failedThemeSwitch() { return { success: false, error: "Theme switching not supported in RPC mode" }; }
