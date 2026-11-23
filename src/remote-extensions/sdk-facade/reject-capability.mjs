import { UnsupportedRemoteExtensionError } from "./create-unsupported-error.mjs";

export function unsupported(member) {
  throw new UnsupportedRemoteExtensionError(member);
}
