import { join } from "node:path";
import type { ArtifactPlatform } from "../../../artifacts/store/store-types.ts";
import { run } from "../archive/run-archive-command.ts";
import { nativePlatform } from "../artifacts/detect-artifact-platform.ts";
import { sha256 } from "../artifacts/hash-artifact.ts";
import { download } from "./download-node-runtime.ts";

export async function nodeRuntime(platform: ArtifactPlatform, work: string): Promise<string> {
  if (platform === nativePlatform()) return process.execPath;
  const distribution = `node-v${process.versions.node}-linux-${platform === "aarch64" ? "arm64" : "x64"}`;
  const filename = `${distribution}.tar.xz`;
  const base = `https://nodejs.org/dist/v${process.versions.node}`;
  const sums = await fetch(`${base}/SHASUMS256.txt`);
  if (!sums.ok) throw new Error(`Cannot download Node runtime checksums: ${sums.status}`);
  const expected = (await sums.text()).split("\n").map((line) => line.trim().split(/\s+/u)).find((entry) => entry[1] === filename)?.[0];
  if (!expected || !/^[a-f0-9]{64}$/u.test(expected)) throw new Error(`No Node runtime checksum for ${filename}.`);
  const archive = join(work, filename);
  await download(`${base}/${filename}`, archive);
  if (await sha256(archive) !== expected) throw new Error("Node runtime archive SHA-256 does not match its release checksum.");
  await run("tar", ["-xJf", archive, "-C", work, "--strip-components=2", `${distribution}/bin/node`]);
  return join(work, "node");
}
