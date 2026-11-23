import { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { BACKGROUND_CONTEXT, withAbortSignal } from "@earendil-works/chord/context";
import type { TargetEnvironmentLease } from "../connection/connection-types.ts";

export function pythonBootstrapRemote(environment: TargetEnvironmentLease): RemoteExecutionEnv {
  return new RemoteExecutionEnv({ connection: environment.connection, id: environment.generation, cwd: "/" });
}

export async function runPythonBootstrapCommand(remote: RemoteExecutionEnv, signal: AbortSignal, argv: readonly string[]) {
  let output = "";
  const result = await remote.exec(argv, { onOutput(text) { output = (output + text).slice(-8192); } }, withAbortSignal(signal, BACKGROUND_CONTEXT));
  if (!result.ok) throw result.error;
  return { exitCode: result.value.exitCode, output };
}
