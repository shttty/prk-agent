import { unsupported } from "./reject-capability.mjs";

export function readFacadeMember(ctx, owner, label, target, key, receiver) {
  ctx.assertLive(owner);
  if (!Object.hasOwn(target, key)) return unsupported(`${label}.${String(key)}`);
  return Reflect.get(target, key, receiver);
}
