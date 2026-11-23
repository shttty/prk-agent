// The row shared by the workspace file tree and the target directory picker, rendered for real.
import assert from "node:assert/strict";
import test from "node:test";
import "../load-web-jsx.mjs";

const { createElement: h } = await import("../../../../web/node_modules/react/index.js");
const { renderToStaticMarkup } = await import("../../../../web/node_modules/react-dom/server.node.js");
const { EntryRow } = await import("../../../../web/workspace/file-tree/EntryRow.jsx");
const { FileRow } = await import("../../../../web/workspace/file-tree/FileRow.jsx");
const { TreeContext } = await import("../../../../web/workspace/file-tree/tree-context.js");

const folder = { name: "src", type: "directory", path: "/w/src" };
const file = (name) => ({ name, type: "file", path: `/w/${name}` });
const row = (props) => renderToStaticMarkup(h(EntryRow, props));
const icon = (markup) => /tabler-icon-([\w-]+)/.exec(markup)?.[1];

test("a row shows the type icon and the name, with the full path as its title", () => {
  const dir = row({ entry: folder });
  assert.equal(icon(dir), "folder");
  assert.match(dir, /pi-files-icon is-dir"/);
  assert.match(dir, /title="\/w\/src"/);
  assert.match(dir, /<span class="pi-files-name">src<\/span>/);
  assert.deepEqual(["notes.md", "photo.png", "python3"].map((name) => icon(row({ entry: file(name) }))), ["file-text", "photo", "file"]);
  assert.doesNotMatch(row({ entry: file("python3") }), /is-dir/);
});

test("active marks the row; caller attributes and disabled reach the button", () => {
  assert.match(row({ entry: file("a.py"), active: true }), /class="pi-files-row is-active"/);
  assert.match(row({ entry: file("a.py") }), /class="pi-files-row"/);
  const hooked = row({ entry: file("a.py"), "data-action": "file-select", "data-path": "/w/a.py", disabled: true });
  assert.match(hooked, /data-action="file-select"/);
  assert.match(hooked, /data-path="\/w\/a.py"/);
  assert.match(hooked, /disabled=""/);
});

test("the file tree highlights only the open file, and keeps its row menu", () => {
  const tree = { activePath: "/w/a.py", editing: null, cutPath: null };
  const render = (entry) => renderToStaticMarkup(h(TreeContext.Provider, { value: tree }, h(FileRow, { entry })));
  const open = render(file("a.py"));
  assert.match(open, /aria-current="true"/);
  assert.match(open, /pi-files-row is-active/);
  assert.match(open, /class="pi-files-more"/);
  const other = render(file("b.py"));
  assert.doesNotMatch(other, /aria-current|is-active/);
  assert.doesNotMatch(render({ ...folder, path: "/w/a.py" }), /is-active/, "a folder is never the open file");
});
