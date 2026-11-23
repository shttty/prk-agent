import type { TargetConnection } from "./instance-types.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { TargetConnectionInput } from "../../target-environment/connection/connection-types.ts";
import { validConnection } from "../wire/instance-parameters/valid-connection.ts";
import { WireError } from "../wire/create-error.ts";

export function discoveryConnection(connection: TargetConnection, limits: LimitsOptions): TargetConnectionInput {
  if (!validConnection(connection, limits)) throw new WireError("INVALID_REQUEST", "Target connection draft is invalid.");
  return connection.local ? { local: true } : { local: false, command: connection.sshCommand! };
}
