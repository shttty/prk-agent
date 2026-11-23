// What the target directory picker lists: dotfiles hidden until switched on, the name filter, and which rows act.
import assert from "node:assert/strict";
import test from "node:test";
import "../load-web-jsx.mjs";

const { createElement: h } = await import("../../../../web/node_modules/react/index.js");
const { renderToStaticMarkup } = await import("../../../../web/node_modules/react-dom/server.node.js");
const { MantineProvider } = await import("../../../../web/node_modules/@mantine/core/esm/index.mjs");
const { PickerEntries } = await import("../../../../web/instances/directory-picker/PickerEntries.jsx");
const { DirectoryPicker } = await import("../../../../web/instances/directory-picker/DirectoryPicker.jsx");

const at = (dir) => (name, type = "file") => ({ name, type, path: `${dir}/${name}` });
const home = at("/home/u");
const HOME = [home("proj", "directory"), home(".venv", "directory"), home(".bashrc"), home("notes.md"), home("Alpha", "directory")];
const bin = at("/home/u/.venv/bin");
const BIN = [bin("pip"), bin("python3.12"), bin("python"), bin("activate"), bin("python3")];
const render = (node) => renderToStaticMarkup(h(MantineProvider, null, node));
const list = (props) => render(h(PickerEntries, { showHidden: false, query: "", fileMode: true, onOpen() {}, onPick() {}, ...props }));
const rows = (markup) => [...markup.matchAll(/<button[^>]*>/g)].map(([tag]) => ({
  path: /data-path="([^"]*)"/.exec(tag)?.[1], action: /data-action="([^"]*)"/.exec(tag)?.[1] ?? null, disabled: / disabled=""/.test(tag),
}));
const names = (markup) => rows(markup).map(({ path }) => path.split("/").pop());
const state = (markup) => /data-state="([^"]*)"/.exec(markup)?.[1];

test("dotfiles stay hidden until the switch is on; folders sort first", () => {
  assert.deepEqual(names(list({ entries: HOME })), ["Alpha", "proj", "notes.md"]);
  assert.deepEqual(names(list({ entries: HOME, showHidden: true })), [".venv", "Alpha", "proj", ".bashrc", "notes.md"]);
});

test("the filter matches names case-insensitively within the listed directory", () => {
  assert.deepEqual(names(list({ entries: BIN, query: "python" })), ["python", "python3", "python3.12"]);
  assert.deepEqual(names(list({ entries: BIN, query: " PY " })), ["python", "python3", "python3.12"]);
  assert.deepEqual(names(list({ entries: HOME, query: "venv" })), [], "the filter does not reveal hidden entries");
});

test("an empty result says why", () => {
  assert.equal(state(list({ entries: [] })), "empty");
  assert.equal(state(list({ entries: [home(".bashrc")] })), "hidden-only");
  assert.equal(state(list({ entries: BIN, query: "ruby" })), "no-match");
});

test("folders open in both modes; files are picked only in file mode", () => {
  const file = rows(list({ entries: HOME }));
  assert.deepEqual(file.map(({ action }) => action), ["directory-open", "directory-open", "file-select"]);
  const directory = rows(list({ entries: HOME, fileMode: false }));
  assert.deepEqual(directory.map(({ action, disabled }) => [action, disabled]), [["directory-open", false], ["directory-open", false], [null, true]]);
});

test("the picker opens with dotfiles hidden and no filter", () => {
  const markup = render(h(DirectoryPicker, { directory: { path: "/home/u", atRoot: false, entries: HOME, truncated: false, loading: false, error: "" }, mode: "file", onBrowse() {}, onBack() {}, onSelect() {} }));
  assert.match(markup, /id="directory-filter"[^>]*value=""/);
  assert.doesNotMatch(markup, /id="directory-hidden"[^>]*checked/);
  assert.deepEqual(rows(markup).filter(({ action }) => action === "directory-open" || action === "file-select").map(({ path }) => path), ["/home/u/Alpha", "/home/u/proj", "/home/u/notes.md"]);
});
