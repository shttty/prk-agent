import { closeSync, constants, createReadStream, openSync, writeSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";

const [generation, pgid, scoped, maximum, chunkBytes, runtime, ...inherited] = process.argv.slice(1);
const maxFrameBytes = Number(maximum);
const { maxMessageBytes, maxImages, maxImageBytes, maxActiveCells, packageRoot } = JSON.parse(runtime);
const blockBytes = Math.min(Number(chunkBytes), Math.floor(maxFrameBytes / 8));
const O_CLOEXEC = 0o2000000; // Linux; node:fs does not expose this flag.
const [input, output, stdout, stderr] = inherited.map((fd, index) =>
  openSync(`/proc/self/fd/${fd}`, O_CLOEXEC | (index === 1 ? constants.O_WRONLY : constants.O_RDONLY)));
// Reopen first, then close all inherited originals before ready.
for (const fd of inherited) closeSync(Number(fd));

function emit(event) {
  const frame = Buffer.from(JSON.stringify({ generation, ...event }) + "\n");
  if (frame.length > maxFrameBytes) throw new Error("Bun output exceeds process frame budget");
  for (let offset = 0; offset < frame.length;) {
    offset += writeSync(output, frame, offset, frame.length - offset);
  }
}

async function capture(fd, stream) {
  const overhead = Buffer.byteLength(JSON.stringify({ generation, kind: "diagnostic", stream, text: "" }) + "\n");
  // Each input byte can cost up to six JSON bytes (e.g. a NUL), plus up to three bytes held by the UTF-8 decoder.
  const size = Math.min(Number(chunkBytes), Math.floor((maxFrameBytes - overhead) / 6) - 3, 64 * 1024);
  if (size < 1) throw new Error("Bun diagnostic frame budget is too small");
  const decoder = new StringDecoder("utf8");
  const report = (text) => { if (text) emit({ kind: "diagnostic", stream, text }); };
  for await (const bytes of createReadStream(null, { fd, highWaterMark: size })) {
    for (let offset = 0; offset < bytes.length; offset += size) {
      report(decoder.write(bytes.subarray(offset, offset + size)));
    }
  }
  report(decoder.end());
}

const diagnostics = Promise.all([capture(stdout, "stdout"), capture(stderr, "stderr")]);
let packageBase;
try {
  packageBase = pinPackageSet(packageRoot);
  emit({ kind: "ready", cellId: null, language: "bun", version: Bun.version, pid: process.pid, pgid: Number(pgid), scoped: scoped === "true" });
  await Promise.race([readControl(), diagnostics]);
} catch (error) {
  emit({ kind: "fatal", cellId: null, error: `Bun control/diagnostic failure: ${String(error).slice(0, 256)}` });
  process.exitCode = 1;
} finally {
  // Drop the writers before waiting for EOF on the raw diagnostic readers.
  closeSync(1);
  closeSync(2);
  try { await diagnostics; }
  finally { closeSync(output); }
}
