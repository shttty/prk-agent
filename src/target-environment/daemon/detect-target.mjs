import { randomBytes } from "node:crypto";
import { observeMarker } from "./observe-marker.mjs";
import { writeInput } from "./write-input.mjs";

export async function detectTarget(child, report) {
  const nonce = randomBytes(16).toString("hex");
  const begin = `PRK_BEGIN_${nonce}`;
  const end = `PRK_END_${nonce}`;
  const observed = observeMarker(child.stdout, Buffer.from(`${end}\n`), 10000, "detect");
  await writeInput(child.stdin, `printf '%s\\n' '${begin}'
uname -s
uname -m
printf '%s\\n' "$HOME" "$0"
id -u
for tool in base64 sha256sum mkdir mv chmod rm tar gzip getconf mktemp; do command -v "$tool" || printf 'MISSING:%s\\n' "$tool"; done
printf '%s\\n' '${end}'
`);
  const output = (await observed).toString("utf8");
  const start = output.indexOf(`${begin}\n`);
  if (start < 0) throw new Error("detect: BEGIN marker missing");
  const [os, arch, home, shell, uid, ...tools] = output.slice(start + begin.length + 1).trimEnd().split("\n");
  if (!home?.startsWith("/") || !uid?.match(/^\d+$/) || tools.length !== 10 || tools.some((tool) => !tool.startsWith("/"))) {
    throw new Error(`detect: invalid target or missing tools: ${tools.join(", ")}`);
  }
  const platform = { Linux: "linux", Darwin: "darwin" }[os];
  const architecture = { x86_64: "x64", aarch64: "arm64", arm64: "arm64" }[arch];
  if (!platform || !architecture) throw new Error(`detect: unsupported platform ${os}/${arch}`);
  const target = { platform, arch: architecture, home, shell, uid };
  report({ kind: "detected", ...target });
  return target;
}
