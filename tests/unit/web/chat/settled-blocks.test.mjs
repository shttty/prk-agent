// The settled-blocks parser must give the same tree as a full parse at every point of a stream, and the same HTML.
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "../../../../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../../../web/node_modules/react-dom/server.node.js";
import ReactMarkdown from "../../../../web/node_modules/react-markdown/index.js";
import { unified } from "../../../../web/node_modules/unified/index.js";
import remarkParse from "../../../../web/node_modules/remark-parse/index.js";
import remarkGfm from "../../../../web/node_modules/remark-gfm/index.js";
import { settledBlocksPlugin } from "../../../../web/chat/markdown/settled-blocks-plugin.js";
import { REAL_REPLIES } from "./streamed-replies.mjs";

const EDGE_CASES = {
  "unclosed fence with blank lines and markdown inside": "Intro.\n\n```python\nx = 1\n\n# not a heading\n- not a list\n\n```\n\nAfter.\n\n```js\nconst open = true;\n\nstill code",
  "tilde fence closed by a longer fence": "a\n\n~~~\n```\n\n~~~~\n\nb",
  "nested lists, loose and tight": "1. one\n   - a\n   - b\n\n     continued\n\n2. two\n\n   - c\n\n3. three\n\nend\n\n- x\n\n- y",
  "indented list (3 spaces) after a paragraph": "text\n\n   - item\n     more\n\n   - item 2\n\npara",
  table: "| a | b |\n| :- | -: |\n| 1 | 2 |\n| 3 | 4 |\n\nnext\n\n| c |\n|---|\n| 5 |",
  "setext heading and thematic break": "Title\n=====\n\npara\n---\n\n***\n\nSub\n---",
  "indented code then paragraph": "p\n\n    code 1\n\n    code 2\n\np2",
  "blockquote and html comment": "> q1\n> q2\n\n> q3\n\n<!--\ncomment\n\nstill\n-->\n\nafter",
  "reference definitions disable caching": "see [x] and [^1]\n\nmore\n\n[x]: https://example.com\n\n[^1]: note",
};
const SAMPLES = [...REAL_REPLIES.map((text, index) => [`real reply ${index + 1}`, text, 9]), ...Object.entries(EDGE_CASES).map(([name, text]) => [name, text, 1])];
const full = unified().use(remarkParse).use(remarkGfm);
const strip = (tree) => JSON.parse(JSON.stringify(tree));

test("the settled-blocks tree equals a full parse at every stream position", () => {
  for (const [name, text, step] of SAMPLES) {
    const incremental = unified().use(remarkParse).use(remarkGfm).use(settledBlocksPlugin());
    for (let end = 1; end <= text.length; end += step) {
      const doc = text.slice(0, end);
      assert.deepEqual(strip(incremental.parse(doc)), strip(full.parse(doc)), `${name} at ${end}`);
    }
    assert.deepEqual(strip(incremental.parse(text)), strip(full.parse(text)), `${name} complete`);
  }
});

test("a text that is replaced, not extended, starts over", () => {
  const incremental = unified().use(remarkParse).use(remarkGfm).use(settledBlocksPlugin());
  incremental.parse("first\n\nsecond\n\nthird");
  const replaced = "other\n\n- list";
  assert.deepEqual(strip(incremental.parse(replaced)), strip(full.parse(replaced)));
});

test("rendered HTML with the plugin equals the default pipeline while streaming", () => {
  const render = (doc, plugins) => renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: plugins }, doc));
  for (const [name, text] of SAMPLES) {
    const plugins = [remarkGfm, settledBlocksPlugin()];
    for (let end = 1; end <= text.length; end += 37) {
      const doc = text.slice(0, end);
      assert.equal(render(doc, plugins), render(doc, [remarkGfm]), `${name} at ${end}`);
    }
  }
});
