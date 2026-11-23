import { current } from "./layout-store.js";
import { LAYOUT } from "./layout-store.js";
import { readGrid } from "./layout-store.js";
export const LAYOUT_CODE_PREFIX = "PRKL1.";

/** 设置 → 复制布局码: the saved layout values, the current session's stage grid (`grid: { sessionId, value }`, desktop;
 * null without a session) and `context` (window, breakpoint, session state), gzipped into one pasteable line. */
export async function encodeLayoutCode(context) {
  const values = current();
  const grid = context.sessionId ? { sessionId: context.sessionId, value: readGrid(context.sessionId) } : null;
  const json = JSON.stringify({ layout: Object.fromEntries(Object.keys(LAYOUT).map((name) => [name, values[name]])), grid, context });
  const zipped = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let binary = "";
  for (const byte of zipped) binary += String.fromCharCode(byte);
  return LAYOUT_CODE_PREFIX + btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
