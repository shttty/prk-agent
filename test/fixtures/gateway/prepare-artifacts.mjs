import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, readFile, realpath } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { ArtifactStore } from "../../../src/artifacts/store/assemble-store.ts";

const run = promisify(execFile);

// Only executable files, never shell aliases or the production PRK artifact store.
export async function findFixtureExecutable(name) {
  const candidates = (process.env.PATH ?? "").split(delimiter).filter(isAbsolute).map((directory) => join(directory, name));
  for (const candidate of candidates) {
    const file = await realpath(candidate).catch(() => undefined);
    if (!file) continue;
    if (await access(file, constants.X_OK).then(() => true, () => false)) return file;
  }
  throw new Error(`A real ${name} executable is required on PATH; this fixture never downloads binaries.`);
}

export async function prepareArtifacts(home) {
  assert(isAbsolute(home));
  const platform = { x64: "x86_64", arm64: "aarch64" }[process.arch];
  assert.equal(process.platform, "linux", "Native remote acceptance requires Linux namespaces");
  assert(platform, `Unsupported fixture architecture: ${process.arch}`);
  const store = new ArtifactStore(join(home, "assets"));
  for (const name of ["rg", "fd", "bun"]) {
    const file = await findFixtureExecutable(name);
    const bytes = await readFile(file);
    assert.equal(bytes.subarray(0, 4).toString("hex"), "7f454c46", `${name} must be a real ELF binary, not a fixture script`);
    const versionOutput = (await run(file, ["--version"], { timeout: 5000, maxBuffer: 64 * 1024 })).stdout;
    const version = (name === "bun" ? /^(\d+\.\d+\.\d+[^\s]*)/m : /^(?:ripgrep|fd)\s+(\d+\.\d+\.\d+[^\s]*)/m).exec(versionOutput)?.[1];
    assert(version, `Cannot identify real ${name}: ${versionOutput}`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await store.upload(name, version, platform, createReadStream(file), sha256);
  }
}
