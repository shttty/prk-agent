import type { HostedExtensionUiSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import type { ExtensionUiRender } from "../store-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { extensionUiRevision } from "./extension-ui-revision.ts";
import { patchSession } from "../updates/patch-session.ts";

/** Take an extension UI value (scalar snapshot, or rendered view with `rendered`) unless the page already holds a newer revision. */
export function acceptExtensionUi(ctx: StoreContext, value: unknown, { rendered = false, displayOnly = false } = {}): boolean {
  if (!isRecord(value)) return false;
  const revision = extensionUiRevision(value);
  if (revision === null) return false;
  const previous = extensionUiRevision(rendered ? ctx.state.session.extensionUiRender : ctx.state.session.extensionUi);
  if (previous !== null && revision < previous) return false;
  // The Gateway builds both shapes; the revision above is the only field the store reads.
  patchSession(ctx, rendered ? { extensionUiRender: value as ExtensionUiRender } : { extensionUi: value as unknown as HostedExtensionUiSnapshot }, { displayOnly });
  return true;
}
