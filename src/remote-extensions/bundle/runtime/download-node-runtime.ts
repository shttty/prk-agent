import { open } from "node:fs/promises";

export async function download(url: string, path: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Cannot download Node runtime: ${response.status} ${url}`);
  const file = await open(path, "wx", 0o600);
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await file.writeFile(value);
    }
  } finally { reader.releaseLock(); await file.close(); }
}
