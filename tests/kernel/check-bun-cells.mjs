import assert from "node:assert/strict";
import { withBunOwner, text } from "./fixtures/create-bun-owner.mjs";

await withBunOwner(async (owner) => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const tools = [{ name: "echo", description: "Return data for this cell.", parameters: {} }];
  const sdk = {
    tools,
    async executeTool(name, { tag, payload }) {
      assert.equal(name, "echo");
      assert.equal(payload, "界".repeat(31000));
      if (tag === "A") { entered.resolve(); await release.promise; }
      return { isError: false, result: { content: [], structuredContent: tag.repeat(150000) } };
    },
  };
  const execution = new AbortController();
  const deadline = AbortSignal.timeout(10000);
  const signal = AbortSignal.any([execution.signal, deadline]);
  const run = (id, code) => owner.executeForeground(id, { code }, signal, undefined, sdk);
  const a = run("a", `const value: { n: number } = { n: 41 };
    globalThis.shared = value;
    console.log('A start');
    try { const reply = await gateway.echo({ tag: 'A', payload: '界'.repeat(31000) });
      console.log(reply.length, reply.at(-1));
      display({mimeType:'image/png', data: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==', 'base64'))});
      return value.n;
    } finally { console.error('A finally'); }
  `);
  try {
    await Promise.race([entered.promise, a.then((result) => assert.fail(text(result)))]);
    const b = await run("b", `console.log('B only'); globalThis.console.log('raw-diagnostic');
      const list = await gateway.describe();
      const reply = await gateway.call(list[0].name, { tag: 'B', payload: '界'.repeat(31000) });
      return JSON.stringify([++shared.n, reply.length, reply.at(-1), typeof value]);`);
    assert.equal(b.details.outcome, "ok", text(b));
    assert.match(text(b), /B only[\s\S]*\[42,150000,"B","undefined"\]/);
    assert.doesNotMatch(text(b), /A start|A finally|raw-diagnostic/);
    assert.equal(b.content.some(({ type }) => type === "image"), false);
  } finally { release.resolve(); await a.catch(() => {}); }
  const result = await a;
  assert.equal(result.details.outcome, "ok", text(result));
  assert.match(text(result), /A start[\s\S]*150000 A[\s\S]*A finally[\s\S]*42/);
  assert.doesNotMatch(text(result), /B only|raw-diagnostic/);
  assert.equal(result.content.filter(({ type }) => type === "image").length, 1, text(result));
  assert.match(owner.getSnapshot().diagnostics.stdout, /raw-diagnostic/);
});
console.log("PASS: concurrent JS/TS Bun cells, owned output, image, chunked callbacks");
