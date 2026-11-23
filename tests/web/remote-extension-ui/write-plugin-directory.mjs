import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = fileURLToPath(new URL("../../fixtures/", import.meta.url));

// A local-directory Pi package (installed by absolute path, linked, never copied): `fixture` copies a file from
// tests/fixtures as index.js, `source` writes inline module text.
export async function writePluginDirectory(directory, { name, version = "1.0.0", fixture, source }) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name, version, private: true, type: "module", pi: { extensions: ["./index.js"] },
  }, null, 2) + "\n");
  if (fixture) await copyFile(join(fixtures, fixture), join(directory, "index.js"));
  else await writeFile(join(directory, "index.js"), source);
  return directory;
}
