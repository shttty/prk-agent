import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadChromium } from "../../../../tests/fixtures/workspace-mock.mjs";

export async function renderOverview(out, screens, allTags) {
  const browser = await loadChromium();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const img = (screen, tag) => { const file = join(out, `${screen}-${tag}.png`); return existsSync(file) ? `<img src="${pathToFileURL(file).href}" class="${tag.split("-")[0]}">` : "<div class=\"none\"></div>"; };
  const style = "<style>body{margin:0;padding:24px;background:#d9d9d6;font:600 18px system-ui,'Noto Sans CJK SC';color:#222}h2{font-size:18px;margin:18px 0 8px}.row{display:flex;gap:12px;align-items:flex-start}img{display:block;border-radius:6px;box-shadow:0 1px 3px #0003}img.desktop{width:640px}img.phone{width:260px}.none{width:260px;height:40px}</style>";
  const rows = screens.map((screen) => `<h2>${screen}</h2><div class="row">${allTags.map((tag) => img(screen, tag)).join("")}</div>`).join("");
  const html = join(out, ".overview.html");
  writeFileSync(html, `<!doctype html><meta charset="utf-8">${style}${rows}`);
  await page.goto(pathToFileURL(html).href);
  await page.waitForLoadState("load");
  await page.screenshot({ path: join(out, "overview.png"), fullPage: true });
  await browser.close();
}
