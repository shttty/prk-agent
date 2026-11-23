import { mkdir, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";

/** The owned target tree the browser steps work on (local target: the daemon sees these real files). The session cwd is
 * `work`; `big` sits beside it, because the @ candidate listing is a bounded recursive walk of the whole directory below
 * the token and a 1100-entry subtree inside the cwd would hide its siblings (recorded as a finding in the report). */
export async function seedFiles(root) {
  const work = join(root, "work");
  const big = join(root, "big");
  const at = (...parts) => join(work, ...parts);
  for (const dir of ["proj/src", "proj2/other", "empty-dir", "full-dir", ".dotdir"]) await mkdir(at(dir), { recursive: true });
  await mkdir(big);
  await writeFile(at("notes.txt"), "hello notes\n");
  await writeFile(at(".hidden-file"), "secret\n");
  await writeFile(at(".dotdir/inner.txt"), "inner\n");
  await writeFile(at("proj/README.md"), "# proj\n");
  await writeFile(at("proj/src/main.py"), "print('main')\n");
  await writeFile(at("proj2/only-on-second.txt"), "second\n");
  await writeFile(at("full-dir/keep.txt"), "keep\n");
  await symlink(at("proj"), at("link-dir"));
  // More entries than directoryEntries/maxEntries (1000): the Gateway must report truncated, the UI must show it.
  await Promise.all(Array.from({ length: 1100 }, (_, index) => writeFile(join(big, `f${String(index).padStart(4, "0")}`), "")));
  return { at, root, work, big };
}
