// Layout codes (设置 → 复制布局码) for reproducing a reported layout: decode one, turn it back into the saved layout,
// and open the mock workbench with it at the recorded window size. Test helper only; the product just encodes.
//   node tests/fixtures/layout-code.mjs PRKL1.…   prints the decoded code
import { gunzipSync } from "node:zlib";
import { LAYOUT } from "../../web/shell/layout/layout-store.js";
import { LAYOUT_CODE_PREFIX } from "../../web/shell/layout/encode-layout-code.js";
import { layoutKey } from "../../web/shell/layout/layout-store.js";
import { gridKey } from "../../web/shell/layout/layout-store.js";
import { openMockWorkbench } from "./workspace-mock.mjs";

/** `PRKL1.<base64url gzip JSON>` -> `{ layout, grid, context }` (`grid`: `{ sessionId, value }` or null). */
export function decodeLayoutCode(code) {
  const text = String(code).trim();
  if (!text.startsWith(LAYOUT_CODE_PREFIX)) throw new Error(`not a ${LAYOUT_CODE_PREFIX} layout code`);
  return JSON.parse(gunzipSync(Buffer.from(text.slice(LAYOUT_CODE_PREFIX.length), "base64url")).toString("utf8"));
}

/** localStorage entries that restore the saved layout of a decoded code (unknown names are ignored), and the recorded
 * session's stage grid when there is one. */
export const layoutStorage = (layout, grid = null) => ({
  ...Object.fromEntries(Object.entries(layout).filter(([name]) => name in LAYOUT).map(([name, value]) => [layoutKey(name), JSON.stringify(value)])),
  ...(grid?.value ? { [gridKey(grid.sessionId)]: JSON.stringify(grid.value) } : {}),
});

/** Open the mock workbench as the code was taken: its saved layout written back, its viewport and breakpoint. */
export function openFromLayoutCode(browser, serverUrl, code, options = {}) {
  const { layout, grid, context } = decodeLayoutCode(code);
  return openMockWorkbench(browser, serverUrl, {
    ...options,
    viewport: context.viewport,
    deviceScaleFactor: context.devicePixelRatio,
    mobile: context.breakpoint === "phone",
    storage: { ...options.storage, ...layoutStorage(layout, grid) },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(decodeLayoutCode(process.argv[2]), null, 2));
