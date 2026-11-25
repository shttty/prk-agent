import assert from "node:assert/strict";
import { rm, truncate, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

export async function verifyInlineImages(t, f, base, filler, remote) {
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==", "base64");
  const image = (path, headers = { "Sec-Fetch-Site": "same-origin" }, target = f.target) => fetch(
    `${base}/image?${new URLSearchParams({ target, path })}`, { headers, signal: AbortSignal.timeout(30_000) },
  );
  await writeFile(join(f.cwd, "pixel.png"), pixel);
  const shown = await image("./pixel.png");
  assert.equal(shown.status, 200, shown.ok ? undefined : await shown.text());
  assert.equal(shown.headers.get("content-type"), "image/png");
  assert.equal(shown.headers.get("cache-control"), "no-store");
  assert.deepEqual(Buffer.from(await shown.arrayBuffer()), pixel);

  const svg = "<svg xmlns='http://www.w3.org/2000/svg'/>";
  await Promise.all([
    writeFile(join(f.cwd, "spoof.png"), svg), writeFile(join(f.cwd, "pixel.svg"), svg),
    writeFile(join(f.cwd, "mismatch.jpg"), pixel),
  ]);
  for (const path of ["sample.txt", "spoof.png", "pixel.svg", "mismatch.jpg"]) {
    const rejected = await image(path);
    assert.equal(rejected.status, 415, path);
    await rejected.body.cancel();
  }
  for (const [headers, target, status] of [
    [{ "Sec-Fetch-Site": "cross-site" }, f.target, 403],
    [{ "Sec-Fetch-Site": "same-site" }, f.target, 403],
    [{ Origin: "https://foreign.invalid" }, f.target, 403],
    [{}, "wrong-target", 400],
  ]) {
    const rejected = await image("pixel.png", headers, target);
    assert.equal(rejected.status, status);
    await rejected.body.cancel();
  }
  const large = Buffer.concat([pixel, filler]);
  const path = join(f.cwd, "large.png");
  await writeFile(path, large);
  const streamed = await image(path);
  assert.equal(streamed.status, 200);
  assert.equal(streamed.headers.get("content-length"), String(large.length));
  let offset = 0, chunks = 0;
  for await (const chunk of streamed.body) {
    assert(Buffer.from(chunk).equals(large.subarray(offset, offset + chunk.length)));
    offset += chunk.length;
    chunks++;
  }
  assert.equal(offset, large.length);
  assert(chunks > 1);
  if (remote) return;
  const tooLarge = join(f.cwd, "oversized.png");
  await writeFile(tooLarge, pixel);
  await truncate(tooLarge, 32 * 1024 ** 2 + 1);
  const oversized = await image(tooLarge);
  assert.equal(oversized.status, 413);
  await oversized.body.cancel();
  const homePath = join(homedir(), `prk-inline-${basename(f.root)}.png`);
  t.after(() => rm(homePath, { force: true }));
  await writeFile(homePath, pixel);
  const homeImage = await image(`~/${basename(homePath)}`);
  assert.equal(homeImage.status, 200, homeImage.ok ? undefined : await homeImage.text());
  assert.deepEqual(Buffer.from(await homeImage.arrayBuffer()), pixel);
}
