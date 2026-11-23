import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function addAutocompleteProvider(ctx: UiContext, factory: Parameters<ExtensionUIContext["addAutocompleteProvider"]>[0]) { ctx.autocompleteProviders.push(factory); ctx.autocompleteProvider = undefined; publish(ctx); }
