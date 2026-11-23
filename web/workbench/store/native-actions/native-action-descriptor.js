import { isRecord } from "../../payloads/is-record.js";
export function nativeActionDescriptor(ctx, action) {
    const values = [
      ...(Array.isArray(ctx.state.session.nativeCatalog.value?.actions) ? ctx.state.session.nativeCatalog.value.actions : []),
      ...(Array.isArray(ctx.state.session.nativeCatalog.value?.commands) ? ctx.state.session.nativeCatalog.value.commands : []),
    ];
    return values.find((entry) => isRecord(entry) && (entry.name === action || entry.action === action));
  }

