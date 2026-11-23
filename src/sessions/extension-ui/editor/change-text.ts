import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";

export function editorChanged(ctx: UiContext, text: string, clientId?: string): void {
    ctx.state.editorText = text; ctx.state.editorClientId = clientId; ctx.state.editorRevision += 1;
    publish(ctx);
  }
