import assert from "node:assert/strict";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";

const target = await createTarget("local");
let fixture;
try {
  fixture = await createSession(target);
  const { result } = await fixture.run("import matplotlib\nassert matplotlib.get_backend().lower() == 'agg'\nimport matplotlib.pyplot as plt\nfig, ax = plt.subplots()\nax.plot([0, 1, 2], [2, 0, 3])\nprint('REAL_AGG', matplotlib.__version__)");
  assert.equal(Boolean(result.isError), false, JSON.stringify(result));
  const images = result.content.filter(({ type }) => type === "image");
  assert.equal(images.length, 1, "unclosed figure is collected at cell_end");
  assert.equal(images[0].mimeType, "image/png");
  const { result: second } = await fixture.run("assert not plt.get_fignums()\nprint('COLLECTED_FIGURE_CLOSED')");
  assert.equal(Boolean(second.isError), false, JSON.stringify(second));
  assert.equal(second.content.filter(({ type }) => type === "image").length, 0, "collected image must not recur in following cell");
  console.log(JSON.stringify({ status: "PASS", realAgg: true, python: target.python, bytes: Buffer.from(images[0].data, "base64").length }));
} finally { await fixture?.close(); await target.close(); }
