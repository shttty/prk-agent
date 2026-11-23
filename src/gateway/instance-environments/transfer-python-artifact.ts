import { posix } from "node:path";
import type { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { writeTransferredArtifact } from "../../remote-extensions/deployment/write-transferred-artifact.ts";
import { runPythonBootstrapCommand } from "../../target-environment/python/run-python-bootstrap-command.ts";
import type { PythonTransfer } from "./plan-python.ts";

export async function transferPythonArtifact(remote: RemoteExecutionEnv, signal: AbortSignal, cleanupSignal: AbortSignal,
    binChunkBytes: number, item: PythonTransfer, acknowledged: (bytes: number) => void): Promise<void> {
  const { asset, transfer, executable } = item;
  const stage = await runPythonBootstrapCommand(remote, cleanupSignal, ["/bin/sh", "-ec", 'mkdir -p -- "$1"; mktemp -d -- "$1/.upload.XXXXXX"', "prk-python-stage", posix.dirname(asset.path)]);
  if (stage.exitCode !== 0) throw new Error(`Cannot stage ${asset.name}: ${stage.output}`);
  const directory = stage.output.trimEnd();
  const uploadPath = posix.join(directory, "asset");
  try {
    const start = await runPythonBootstrapCommand(remote, signal, ["/bin/sh", "-ec", ': >"$1"; : >"$1.install"', "prk-python-upload", uploadPath]);
    if (start.exitCode !== 0) throw new Error(`Cannot open staging for ${asset.name}: ${start.output}`);
    await writeTransferredArtifact({ remote, signal, binChunkBytes }, { ...asset, executable }, transfer, { uploadPath, blob: asset.path }, acknowledged);
  } finally {
    if (!cleanupSignal.aborted) {
      const cleanup = await runPythonBootstrapCommand(remote, cleanupSignal, ["rm", "-rf", "--", directory]);
      if (cleanup.exitCode !== 0) throw new Error(`Could not remove upload staging for ${asset.name}: ${cleanup.output}`);
    }
  }
}
