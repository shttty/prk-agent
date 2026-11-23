import { unsupported } from "./reject-capability.mjs";

export function readProjectMember(_ctx, label, target, name) {
  return target[name] ?? (() => unsupported(`${label}.${String(name)}`));
}
