import { WireError } from "../../gateway/wire/create-error.ts";
import { CapabilityDiscoveryError } from "../../sessions/global-catalog/discovery-error.ts";

function discoveryError(error: unknown): CapabilityDiscoveryError | undefined {
  if (error instanceof CapabilityDiscoveryError) return error;
  if (error instanceof AggregateError) {
    for (const child of error.errors) {
      const diagnostic = discoveryError(child);
      if (diagnostic) return diagnostic;
    }
  }
}

export function describeCommandError(error: unknown): string {
  if (error instanceof WireError) return error.message;
  const discovery = discoveryError(error);
  if (discovery) return discovery.message;
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return "Endpoint/configuration is missing. Start the gateway separately and check --socket.";
  if (code === "EACCES") return "Private endpoint access denied. Check owner and permissions.";
  if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS")) return "Invalid command arguments. Use --help.";
  return "Gateway command failed. Check configuration and host state; owned cleanup was attempted.";
}
