import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeRenderedRequest(name, request) {
  const directory = process.env.PRK_PROMPT_RENDERED_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${name}.txt`), request.instructions);
  await writeFile(join(directory, `${name}.request.json`), `${JSON.stringify(request.payload, null, 2)}\n`);
}
