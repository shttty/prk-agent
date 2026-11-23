export class UnsupportedRemoteExtensionError extends Error {
  constructor(member) {
    super(`Remote extension host does not support ${member}`);
    this.name = "UnsupportedRemoteExtensionError";
    this.code = "UNSUPPORTED";
    this.details = { member };
  }
}
