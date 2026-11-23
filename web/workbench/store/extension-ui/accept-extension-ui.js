import { isRecord } from "../../payloads/is-record.js";
import { extensionUiRevision } from "./extension-ui-revision.js";
import { patchSession } from "../updates/patch-session.js";
export function acceptExtensionUi(ctx, value, { rendered = false, displayOnly = false } = {}) {
    if (!isRecord(value)) return false;
    const revision = extensionUiRevision(ctx, value);
    if (revision === null) return false;
    const previous = extensionUiRevision(ctx, rendered ? ctx.state.session.extensionUiRender : ctx.state.session.extensionUi);
    if (previous !== null && revision < previous) return false;
    patchSession(ctx, rendered ? { extensionUiRender: value } : { extensionUi: value }, { displayOnly });
    return true;
  }

