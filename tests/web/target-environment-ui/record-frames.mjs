// Records every rendered state of the page's environment panel (`.environment-progress` data attributes) as the real
// Gateway events drive it, and every POST the page sends, so a check can assert progress and the absence of creates.
export async function recordPage(page) {
  const posts = [];
  page.on("request", (request) => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
  await page.addInitScript(() => {
    window.__environmentFrames = [];
    const read = (element) => Object.fromEntries(["environmentStatus", "failure", "target", "stream", "revision", "transferred", "total", "percent", "rate"].map((key) => [key, element.dataset[key] ?? null]));
    const sample = () => {
      for (const element of document.querySelectorAll(".environment-progress")) {
        const frame = read(element);
        const last = window.__environmentFrames.at(-1);
        if (!last || JSON.stringify(last) !== JSON.stringify(frame)) window.__environmentFrames.push(frame);
      }
    };
    new MutationObserver(sample).observe(document, { subtree: true, childList: true, attributes: true });
  });
  return {
    posts,
    frames: () => page.evaluate(() => window.__environmentFrames.map((frame) => ({ ...frame,
      revision: Number(frame.revision), transferred: Number(frame.transferred), total: Number(frame.total), percent: Number(frame.percent), rate: Number(frame.rate) }))),
    clearFrames: () => page.evaluate(() => { window.__environmentFrames = []; }),
  };
}

// One deploy's frames: real ACK progress on one stream (bytes never go back, a transferring frame has a total and a
// rate at some point), ending ready at 100%. Checking frames carry no fake progress.
export function assertDeployFrames(assert, frames, label) {
  const seen = frames.filter((frame) => frame.environmentStatus !== "failed");
  assert.ok(seen.some((frame) => frame.environmentStatus === "transferring" && frame.total > 0), `${label}: real transfer progress rendered`);
  assert.ok(seen.some((frame) => frame.environmentStatus === "transferring" && frame.rate > 0), `${label}: a measured rate rendered`);
  for (const frame of seen.filter((item) => item.environmentStatus === "checking")) assert.deepEqual([frame.transferred, frame.total, frame.percent], [0, 0, 0], `${label}: checking shows no progress`);
  const transfer = seen.filter((frame) => frame.environmentStatus === "transferring");
  assert.equal(new Set(transfer.map((frame) => frame.stream)).size, 1, `${label}: one Gateway stream`);
  for (let index = 1; index < transfer.length; index++) {
    assert.ok(transfer[index].revision >= transfer[index - 1].revision && transfer[index].transferred >= transfer[index - 1].transferred, `${label}: progress never goes back`);
    assert.ok(transfer[index].transferred <= transfer[index].total && transfer[index].percent <= 100, `${label}: bounded progress`);
  }
}
