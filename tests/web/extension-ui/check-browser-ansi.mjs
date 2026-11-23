import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkBrowserAnsi({ invoke, page, until, host, main, viewport, webTheme }) {
  await invoke("/bridge-ansi");
  // Order-based DOM check: machine attributes plus computed styles against the live --pi-* values.
  const ansiTargets = ['[data-widget-key="ansi-probe"]', '[data-status-key="ansi-probe"]', '.pi-message [data-notification-type="warning"]'];
  const ansiReports = () => Promise.all(ansiTargets.map(async (selector) => {
    await page.locator(`${selector} .pi-ansi`).first().waitFor({ state: "attached" });
    return page.locator(selector).last().evaluate((root) => {
      const vars = { success: "--pi-ok", danger: "--pi-danger", warning: "--pi-warn", accent: "--pi-accent-strong", text: "--pi-ink", muted: "--pi-muted", dim: "--pi-faint" };
      const resolveColor = (name) => { const probe = document.createElement("span"); probe.style.color = `var(${name})`; root.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; };
      return [...root.querySelectorAll(".pi-ansi")].map((span) => {
        const style = getComputedStyle(span);
        const { ansiToken: token = null, ansiTone: tone = null, ansiColor: color = null, ansiStyle: decorations = "" } = span.dataset;
        return { token, tone, color, decorations, colorMatches: style.color === (tone ? resolveColor(vars[tone]) : getComputedStyle(span.parentElement).color), weight: Number(style.fontWeight), fontStyle: style.fontStyle, line: style.textDecorationLine, opacity: Number(style.opacity) };
      });
    });
  }));
  const expectedAnsi = [
    ["success", "success"], ["error", "danger"], ["warning", "warning"], ["accent", "accent"], ["text", "text"], ["muted", "muted"], ["dim", "dim"], ["toolDiffRemoved", "danger"],
  ].map(([token, tone]) => ({ token, tone, color: null, decorations: "" })).concat(
    [["red", "danger"], ["bright-green", "success"], ["yellow", "warning"], ["blue", "accent"], ["cyan", "accent"], ["bright-magenta", "accent"], ["black", "muted"], ["bright-black", "muted"], ["bright-white", "text"], ["palette-196", null], ["truecolor", null]]
      .map(([color, tone]) => ({ token: null, tone, color, decorations: "" })),
    ["bold", "dim", "italic", "underline", "strikethrough"].map((decorations) => ({ token: null, tone: null, color: null, decorations })),
    [{ token: "error", tone: "danger", color: null, decorations: "bold italic underline strikethrough" }],
  );
  const assertAnsi = (reports) => {
    for (const report of reports) {
      assert.deepEqual(report.map(({ token, tone, color, decorations }) => ({ token, tone, color, decorations: decorations.split(" ").filter(Boolean).sort().join(" ") })), expectedAnsi.map((item) => ({ ...item, decorations: item.decorations.split(" ").filter(Boolean).sort().join(" ") })));
      for (const span of report) {
        const has = (name) => span.decorations.split(" ").includes(name);
        assert.ok(span.colorMatches, `${span.token || span.color || "plain"} uses its --pi-* tone (or inherits when uncolored)`);
        assert.equal(span.weight >= 600, has("bold"));
        assert.equal(span.fontStyle === "italic", has("italic"));
        assert.equal(span.line.includes("underline"), has("underline"));
        assert.equal(span.line.includes("line-through"), has("strikethrough"));
        assert.equal(span.opacity < 1, has("dim"));
      }
    }
  };
  const ansiBefore = await ansiReports();
  assertAnsi(ansiBefore);
  const color = await page.locator('[data-tool-name="probe_self"] pre').first().evaluate((element) => getComputedStyle(element).color);
  await invoke("/probe theme-set light");
  await until(() => host.state(main.session.sessionId), (state) => state.extensionUi.notifications.some((item) => /^setTheme\(light\)=/.test(item.message)), "browser setTheme");
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-tool-name="probe_self"] pre').first().evaluate((element) => getComputedStyle(element).color), color, "TUI palette does not alter Web colors");
  assert.deepEqual(await ansiReports(), ansiBefore, "plugin setTheme does not alter Web ANSI rendering");
  if (viewport.width > 600) {
    // Every Pi foreground token reaches the Web as a marker with a tone (probe pages bind Record<ThemeColor>).
    const tokens = new Set();
    for (const fgPage of [1, 2, 3]) {
      await invoke(`/probe theme-fg-${fgPage}`);
      const themePage = page.locator('[data-prompt-kind="custom"]');
      await themePage.locator('.pi-ansi').first().waitFor();
      for (const [token, tone] of await themePage.locator('.pi-ansi').evaluateAll((spans) => spans.map((span) => [span.dataset.ansiToken, span.dataset.ansiTone]))) { assert.ok(token && tone, `token ${token} has a Web tone`); tokens.add(token); }
      await themePage.locator('[data-action="cancel"]').click();
      await themePage.waitFor({ state: "hidden" });
    }
    assert.equal(tokens.size, Object.values(webTheme.colors).filter((value) => typeof value === "number").length);
  }
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `ansi-${viewport.width}-before-toggle.png`), fullPage: true });
  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  assertAnsi(await ansiReports());
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `ansi-${viewport.width}-after-toggle.png`), fullPage: true });
}
