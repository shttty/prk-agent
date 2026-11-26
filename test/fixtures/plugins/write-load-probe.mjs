import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * A real Pi package whose tool, command and hooks each append one line to a marker file. It registers only
 * events a remote host also supports (`before_agent_start`, `agent_settled`), so one package serves both locations.
 */
export async function writeLoadProbe(root, name = "loadprobe") {
  const dir = join(root, name);
  const markers = join(root, `${name}.markers`);
  await mkdir(dir, { recursive: true });
  await writeFile(markers, "");
  await writeFile(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", pi: { extensions: ["./index.js"] } }));
  const template = await readFile(new URL("./load-probe-template.js", import.meta.url), "utf8");
  await writeFile(join(dir, "index.js"), template.replace("__NAME__", name).replace("__MARKERS__", markers));
  const lines = async () => (await readFile(markers, "utf8")).split("\n").filter(Boolean);
  return { dir, name, markers: lines, tool: `${name}_tool`, command: `${name}-command` };
}
