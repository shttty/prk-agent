import assert from "node:assert/strict";

const key = (color) => color.join(",");

/** Colour of the page at viewport points, read from a real screenshot decoded by Chromium itself in a throwaway page. */
export async function pixelsAt(driver, points) {
  const png = await driver.page.screenshot({ type: "png" });
  const width = driver.page.viewportSize().width;
  const helper = await driver.context.newPage();
  try {
    return await helper.evaluate(async ({ base64, points, width }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const scale = image.width / width;
      return points.map(([x, y]) => [...context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data].slice(0, 3));
    }, { base64: png.toString("base64"), points, width });
  } finally { await helper.close(); }
}

/** What the terminal of `shell` is on screen: its boxes against its dock group, the .xterm padding, xterm's measured cell. */
export async function terminalGeometry(driver, shell) {
  return driver.page.evaluate((shell) => {
    const box = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
    const term = document.querySelector(`.pi-term[data-shell="${shell}"]`);
    const tab = document.querySelector(`.pi-tab[data-kind="terminal"][data-shell="${shell}"]`);
    const group = tab?.closest(".dv-groupview");
    const host = term?.querySelector(".pi-term-host");
    const xterm = term?.querySelector(".xterm");
    const style = xterm ? getComputedStyle(xterm) : null;
    const measure = term?.querySelector(".xterm-char-measure-element");
    const probe = document.createElement("i"); probe.style.background = "var(--pi-code-bg)"; document.body.append(probe);
    const codeBg = getComputedStyle(probe).backgroundColor; probe.remove();
    const panelBg = term ? getComputedStyle(term).backgroundColor : null;
    const screen = term?.querySelector(".xterm-screen");
    const hostStyle = host ? getComputedStyle(host) : null;
    const overlay = term?.closest(".dv-render-overlay");
    return {
      term: box(term), content: box(group?.querySelector(".dv-content-container")), host: box(host), screen: box(screen), overlay: box(overlay),
      pad: style ? { l: parseFloat(style.paddingLeft), r: parseFloat(style.paddingRight), t: parseFloat(style.paddingTop), b: parseFloat(style.paddingBottom) } : null,
      cellW: measure ? measure.getBoundingClientRect().width / (measure.textContent.length || 1) : null,
      rowH: term?.querySelector(".xterm-rows > div")?.getBoundingClientRect().height, domRows: term?.querySelectorAll(".xterm-rows > div").length,
      visible: Boolean(term && term.offsetParent !== null), codeBg, panelBg, hostScrollW: host?.scrollWidth, hostClientW: host?.clientWidth,
      scheme: document.documentElement.getAttribute("data-mantine-color-scheme"),
      // What FitAddon.proposeDimensions reads (parseInt of the computed strings), and the widths this screen element has had.
      fitInput: hostStyle && style ? { width: hostStyle.width, height: hostStyle.height, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft] } : null,
      screenWidths: screen ? (window.__screenWidths ?? []).filter((entry) => entry.id === window.__screenId?.(screen)).map((entry) => entry.width) : [],
    };
  }, shell);
}

const lastResize = (driver, shell) => driver.sockets(shell).filter((entry) => entry.resizes.length).at(-1)?.resizes.at(-1) ?? null;

/**
 * The user's view of `shell`, taken WITHOUT touching the terminal (no focus, click, tab switch or typing): geometry against its
 * group, real pixels, and the last size the page sent to the PTY. Moving the pointer to the page corner first only removes a
 * tooltip a previous click may have left over the terminal. Asserts what a viewer sees; returns everything for the report.
 */
export async function observeTerminal(driver, shell, label) {
  await driver.page.mouse.move(1, 1);
  await driver.page.waitForTimeout(400);
  const g = await terminalGeometry(driver, shell);
  const sent = lastResize(driver, shell);
  assert.equal(g.visible, true, `${label}: terminal visible`);
  assert.ok(sent, `${label}: the page has sent a size to the PTY`);
  const innerH = g.host.h - g.pad.t - g.pad.b;
  const x = Math.round(g.host.x + g.pad.l + (sent.cols - 0.5) * g.cellW);
  // Rows below the few output lines are empty: their right-most cell shows only the terminal background. (The first rows
  // hold the prompt and wrapped commands, so they are not sampled.) The user's symptom is the panel colour there.
  const points = [[x, Math.round(g.host.y + g.pad.t + (sent.rows / 2) * g.rowH)], [x, Math.round(g.host.y + g.pad.t + (sent.rows - 0.5) * g.rowH)]];
  const [middle, last] = await pixelsAt(driver, points);
  const rgb = (css) => driver.page.evaluate((css) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = css; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }, css);
  const expected = await rgb(g.codeBg);
  const panel = await rgb(g.panelBg);
  const fit = exactFit(g);
  const seen = { label, scheme: g.scheme, term: g.term, group: g.content, overlay: g.overlay, host: g.host, screen: g.screen, pad: g.pad, cellW: g.cellW, rowH: g.rowH, domRows: g.domRows, sent, fit, pixels: { middle, last, expected, panel, points } };
  await driver.rig.log({ observed: seen });
  const slack = 1.5;
  assert.ok(g.term.x >= g.content.x - slack && g.term.r <= g.content.r + slack && g.term.y >= g.content.y - slack && g.term.b <= g.content.b + slack, `${label}: .pi-term ${JSON.stringify(g.term)} lies inside its group ${JSON.stringify(g.content)}`);
  assert.ok(Math.abs(g.term.w - g.content.w) <= slack && Math.abs(g.term.h - g.content.h) <= slack, `${label}: .pi-term fills its group`);
  assert.ok(g.hostScrollW <= g.hostClientW + 1 && g.screen.r <= g.host.r + 0.5, `${label}: the drawn cells end inside the host (screen right ${g.screen.r}, host right ${g.host.r})`);
  // FitAddon's rows: floor(inner height / row height).
  assert.equal(sent.rows, Math.floor(innerH / g.rowH), `${label}: ${sent.rows} rows is what the panel height holds (${innerH.toFixed(1)} / ${g.rowH})`);
  // Cols, exactly as the installed FitAddon computes them from this DOM (see exactFit), starting from the cols the renderer had.
  assert.equal(fit.widths.at(-1), Math.round(sent.cols * g.cellW), `${label}: the renderer draws the ${sent.cols} cols sent (${JSON.stringify(fit)})`);
  assert.equal(sent.cols, fit.proposed, `${label}: ${sent.cols} cols is FitAddon's exact proposal for this host from ${fit.from} cols (${JSON.stringify(fit)})`);
  assert.equal(g.domRows, sent.rows, `${label}: the terminal draws the ${sent.rows} rows it sent`);
  assert.notEqual(key(expected), key(panel), `${label}: terminal and panel colours differ, so the pixel check can tell them apart`);
  assert.equal(key(middle), key(expected), `${label}: the middle row shows the terminal colour ${JSON.stringify(seen.pixels)}`);
  assert.equal(key(last), key(expected), `${label}: the last row shows the terminal colour, not the panel behind it ${JSON.stringify(seen.pixels)}`);
  return seen;
}

/**
 * FitAddon 0.11 `proposeDimensions` on xterm 6's DOM renderer, from DOM values only: cols = floor((parseInt(host width) −
 * parseInt(padding left + right) − 14) / cell width), 14 = xterm's default scrollbar width (scrollback is on, no overview
 * ruler). The renderer's cell width is round(c × char width) / c for the cols c it has when the fit runs, so the same host
 * can give c+1 or c depending on c (256 px: 30 from 80 or 30 cols, 29 from 62). `from`: the cols before the last width
 * change of this .xterm-screen (null: it never changed, so the fit started from its current cols).
 */
function exactFit(g) {
  const [, right, , left] = g.fitInput.padding.map((value) => parseInt(value, 10));
  const available = parseInt(g.fitInput.width, 10) - left - right - 14;
  const propose = (cols) => Math.max(2, Math.floor(available / (Math.round(cols * g.cellW) / cols)));
  const widths = g.screenWidths.map((width) => parseFloat(width));
  const from = widths.length > 1 ? Math.round(widths.at(-2) / g.cellW) : null;
  const current = Math.round(widths.at(-1) / g.cellW);
  return { hostWidth: g.fitInput.width, padding: g.fitInput.padding, available, widths, from, proposed: propose(from ?? current), fixedPoint: propose(current) };
}

/** Only after `observeTerminal`: type `stty size` and require the PTY's real size to equal what was observed, and that the
 * interaction did not have to send a new size first (it would mean the observed state was stale). */
export async function assertSttyMatches(driver, shell, observed, label) {
  await driver.run(shell, "stty size");
  await driver.page.waitForTimeout(600);
  const text = await driver.text(shell);
  const found = [...text.matchAll(/^(\d+) (\d+)$/gmu)].at(-1);
  assert.ok(found, `${label}: stty size is readable in ${JSON.stringify(text.slice(-120))}`);
  const real = { rows: Number(found[1]), cols: Number(found[2]) };
  await driver.rig.log({ stty: { label, real, observedSent: observed.sent, sentAfter: lastResize(driver, shell) } });
  assert.deepEqual(lastResize(driver, shell), observed.sent, `${label}: typing did not make the page send another size`);
  assert.deepEqual(real, observed.sent, `${label}: the PTY's real stty size equals the observed size`);
  return real;
}
