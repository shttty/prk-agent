export class CapabilityDiscoveryError extends Error {
  constructor(failures: readonly string[]) {
    super(`Capability catalog discovery failed:\n${failures.join("\n")}`);
  }
}
