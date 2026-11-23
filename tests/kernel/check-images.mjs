import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";

const images = Object.fromEntries(["png", "jpeg", "gif", "webp", "bmp"].map((format) =>
  [format, execFileSync("/usr/sbin/magick", ["-size", "2x2", "xc:rgb(20,80,140)", `${format}:-`]).toString("base64")]));
const target = await createTarget(process.argv[2] ?? "local");
let fixture;
try {
  fixture = await createSession(target);
  const run = async (code) => {
    const value = await fixture.run(code);
    assert.equal(Boolean(value.result.isError), false, value.text);
    return value;
  };
  const formats = await run(`import base64,json\nimages=json.loads(${JSON.stringify(JSON.stringify(images))})\nfor fmt,data in images.items():\n display({'image/'+fmt:data},raw=True)`);
  assert.equal(formats.result.content.filter(({ type }) => type === "image").length, 5);
  assert(!formats.result.content.some(({ type, mimeType }) => type === "image" && mimeType === "image/bmp"));
  const rich = await run("class Rich:\n def _repr_png_(self): return base64.b64decode(images['png'])\n def __repr__(self): raise RuntimeError('PNG used repr')\nRich()");
  assert.equal(rich.result.content.filter(({ type }) => type === "image").length, 1);
  const unsupported = await run("class Other:\n def _repr_html_(self): raise RuntimeError('unsupported repr called')\n def __repr__(self): return 'PLAIN_REPR'\nOther()");
  assert.match(unsupported.text, /PLAIN_REPR/);
  const count = await run("for _ in range(10): display({'image/png':images['png']},raw=True)");
  assert.equal(count.result.content.filter(({ type }) => type === "image").length, 8);
  assert.match(count.text, /2 additional image outputs omitted/);
  const large = await run("raw=base64.b64decode(images['png'])\nraw=raw+b'x'*(20*1024*1024-len(raw))\ndisplay({'image/png':base64.b64encode(raw).decode()},raw=True)\ndisplay({'image/png':images['png']},raw=True)");
  assert.equal(large.result.content.filter(({ type }) => type === "image").length, 1, large.text);
  assert.match(large.text, /1 additional image outputs omitted/);
  const over = await run("display({'image/png':base64.b64encode(raw+b'x').decode()},raw=True)");
  assert.equal(over.result.content.filter(({ type }) => type === "image").length, 0);
  const matplotlib = await run("import importlib.util\nprint('MATPLOTLIB_AVAILABLE',importlib.util.find_spec('matplotlib') is not None)");
  const available = matplotlib.text.includes("MATPLOTLIB_AVAILABLE True");
  if (available) {
    const plotted = await run("import matplotlib,matplotlib.pyplot as plt\nassert matplotlib.get_backend().lower() == 'agg'\nplt.plot([1,2],[3,5]);\nprint('AGG_FIGURE')");
    assert.equal(plotted.result.content.filter(({ type }) => type === "image").length, 1);
    assert.match((await run("len(plt.get_fignums())")).text, /0/);
  }
  console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", formats: Object.keys(images), rawBytes: 20 * 1024 * 1024, maxImages: 8, matplotlib: available ? "verified" : "package unavailable" }));
} finally { await fixture?.close(); await target.close(); }
