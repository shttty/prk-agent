import type { UiContext } from "../ui-types.ts";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";

export function applyCompletion(ctx: UiContext, provider: AutocompleteProvider, lines: string[], cursorLine: number, cursorCol: number, args: Record<string, unknown>): unknown {
        const item = args.item;
        if (typeof args.prefix !== "string" || typeof item !== "object" || item === null || !("value" in item) || typeof item.value !== "string" || !("label" in item) || typeof item.label !== "string") return { status: "unavailable", message: "Autocomplete item is invalid." };
        return { status: "completed", data: provider.applyCompletion(lines, cursorLine, cursorCol, { value: item.value, label: item.label, ...("description" in item && typeof item.description === "string" ? { description: item.description } : {}) }, args.prefix) };
      
}
