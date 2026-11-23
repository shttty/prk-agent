import { supportedEvents } from "./host-protocol.mjs";
import { registering } from "./assert-registering.mjs";
import { unsupported } from "../sdk-facade/reject-capability.mjs";

export function on(ctx, owner, pkg, event, handler) {
  registering(ctx, owner);
  if (!Object.hasOwn(supportedEvents, event)) unsupported(`event ${event}`);
  if (typeof handler !== "function") throw new TypeError("Remote event handler must be a function");
  const handlerId = `package:${pkg.index}:handler:${pkg.handlers.length}`;
  const registration = { event, handlerId, handler, enabled: true };
  owner.handlers.set(handlerId, registration);
  pkg.handlers.push(handlerId);
  return () => { ctx.assertLive(owner); registration.enabled = false; };
}
