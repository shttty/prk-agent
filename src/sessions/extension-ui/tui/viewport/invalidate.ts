import type { UiContext } from "../../ui-types.ts";
import { publish } from "../../publication/publish-revision.ts";

export function invalidateViewport(ctx: UiContext) { return publish(ctx); }
