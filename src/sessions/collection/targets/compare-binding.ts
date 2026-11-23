import { isDeepStrictEqual } from "node:util";
import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";

export function targetMatches(left: ExecutionTarget, right: ExecutionTarget): boolean {
  return left.id === right.id
    && (left.local === true) === (right.local === true)
    && left.sshCommand === right.sshCommand
    && left.python === right.python
    && left.kernel.target === right.kernel.target
    && left.kernel.executionTimeoutMs === right.kernel.executionTimeoutMs
    && isDeepStrictEqual(left.kernel.kernelOptions, right.kernel.kernelOptions);
}
