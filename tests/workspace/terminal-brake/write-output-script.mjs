import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeOutputScript(tempRoot, name, output, gate = false) {
  const path = join(tempRoot, `${name}.py`);
  const release = join(tempRoot, `${name}-release`);
  await writeFile(path, `import pathlib, sys, time
output = ${JSON.stringify(output)}
for start in range(0, len(output), 37):
    sys.stdout.write("\\x1b[32m" + output[start:start + 37] + "\\x1b[0m")
    sys.stdout.flush()
    time.sleep(0.002)
${gate ? `while not pathlib.Path(${JSON.stringify(release)}).exists():\n    time.sleep(0.01)\n` : ""}`);
  return { text: `python3 ${JSON.stringify(path)}`, release };
}
