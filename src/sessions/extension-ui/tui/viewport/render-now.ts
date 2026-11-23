import type { UiContext } from "../../ui-types.ts";
import { publish } from "../../publication/publish-revision.ts";

export function renderNow(ctx: UiContext) { return publish(ctx); }
