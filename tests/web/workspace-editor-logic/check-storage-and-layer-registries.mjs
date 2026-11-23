// ── every saved layout state is in the LAYOUT table: no other localStorage key in web/ may hold layout ──
// ── layer table: no hand-written z-index outside the unique layer table ──
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export async function checkStorageAndLayerRegistries(ctx) {
{
  const root = new URL("../../../web/", import.meta.url).pathname;
  // Non-layout storage, each with why it is not reset by "重置布局". A new localStorage use must be registered in the
  // layout module (a LAYOUT value, or a document key read and written only there) or, if it is not layout, listed here.
  const NOT_LAYOUT = [
    [/localStorageColorSchemeManager\(\{ key: "pi-session-theme" \}\)/, "colour scheme"],
    [/localStorage\??\.(get|set)Item\("pi-session-view"/, "session list grouping (spaces / projects)"],
    [/localStorage\.(get|set)Item\("pi\.files\.showHidden"/, "files: show dotfiles"],
    [/window\.localStorage\.(get|set)Item\(NOTIFY_KEY/, "ask reminder: opt-in to system notifications (a browser permission, not layout)"],
    [/localStorage\.(get|set|remove)Item\(key[,)]/, "open files of a worker's phone workspace (editorLayoutKey); the reset only merges its split grid"],
    [/localStorage\.(get|set|remove)Item\(foldKey\(sessionId\)/, "background-task fold preference per session, not workspace layout"],
  ];
  const stray = [];
  const walk = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { if (["node_modules", "dist"].includes(entry.name)) continue; const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else if (/\.jsx?$/.test(entry.name)) check(path); } };
  const check = (file) => {
    const name = relative(root, file);
    if (file === fileURLToPath(ctx.layoutModule)) return;
    const text = readFileSync(file, "utf8");
    text.split("\n").forEach((line, index) => {
      // The layout module's raw storage handle stays inside it: other files go through its registered readers/writers.
      if (/^import .*\bstorage\b.*layout-store/.test(line)) { stray.push(`${name}:${index + 1}`); return; }
      if (!/localStorage/.test(line) || /^import /.test(line)) return;
      const rule = NOT_LAYOUT.find(([pattern]) => pattern.test(line));
      if (!rule || (rule === NOT_LAYOUT[4] && !text.includes("editorLayoutKey("))) stray.push(`${name}:${index + 1}`);
    });
  };
  walk(root);
  assert.deepEqual(stray, [], "localStorage outside the layout table: register layout state in LAYOUT, or list it in NOT_LAYOUT with the reason");
  assert.ok(Object.keys(ctx.LAYOUT).every((name) => ctx.layoutKey(name).startsWith("pi.layout.")));
  // The document keys (stage grid per session, saved layouts) are layout too, and never shadow a LAYOUT value.
  const { gridKey, PRESETS_KEY } = await import(ctx.layoutModule);
  for (const key of [gridKey("s1"), PRESETS_KEY]) {
    assert.ok(key.startsWith("pi.layout."), key);
    assert.ok(!Object.keys(ctx.LAYOUT).some((name) => key === ctx.layoutKey(name) || key.startsWith(`${ctx.layoutKey(name)}.`)), key);
  }
}

{
  const root = new URL("../../../web/", import.meta.url).pathname;
  const files = [];
  const walk = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { if (["node_modules", "dist"].includes(entry.name)) continue; const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else if (/\.(css|jsx?)$/.test(entry.name)) files.push(path); } };
  walk(root);
  const tables = files.filter((file) => /--pi-z-[a-z-]+\s*:\s*-?\d/.test(readFileSync(file, "utf8")));
  assert.equal(tables.length, 1, "exactly one web file defines the layer table (--pi-z-*: number)");
  const [tableFile] = tables;
  const bare = [];
  for (const file of files) {
    const name = relative(root, file);
    if (file === tableFile) continue;
    readFileSync(file, "utf8").split("\n").forEach((line, index) => { if (/z-?index\s*:\s*-?\d/i.test(line)) bare.push(`${name}:${index + 1}`); });
  }
  assert.deepEqual(bare, [], "z-index values live in the layer table (--pi-z-*), not as bare numbers");
  const table = readFileSync(tableFile, "utf8");
  const used = new Set(files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/var\((--pi-z-[a-z-]+)\)/g)].map((match) => match[1])));
  for (const name of used) assert.match(table, new RegExp(`${name}:\\s*\\d`), `${name} is defined in the layer table`);
}

console.log("PASS workspace editor logic: saved layout validation, tab placement, path bookkeeping, file store, list filter, layout store and widths");
}
