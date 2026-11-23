import type { UiContext } from "../ui-types.ts";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { applyCompletion } from "./apply-completion.ts";
import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui";

export async function complete(ctx: UiContext, args: Record<string, unknown>): Promise<unknown> {
      const { lines, cursorLine, cursorCol, clientId } = args;
      if (typeof clientId !== "string" || !Array.isArray(lines) || !lines.every((line): line is string => typeof line === "string") || typeof cursorLine !== "number" || !Number.isInteger(cursorLine) || cursorLine < 0 || cursorLine >= lines.length || typeof cursorCol !== "number" || !Number.isInteger(cursorCol) || cursorCol < 0 || cursorCol > lines[cursorLine]!.length) return { status: "unavailable", message: "Autocomplete cursor is invalid." };
      if (!ctx.autocompleteProvider) {
        const commands = ctx.session.extensionRunner.getRegisteredCommands().map((command) => ({ name: command.invocationName, description: command.description, getArgumentCompletions: command.getArgumentCompletions }));
        // Pi has no public switch for CombinedAutocompleteProvider's file/path part (`@` attachments, `./`, `~/`, and an
        // empty prefix after whitespace or CJK punctuation); it lists the Gateway's own cwd, the wrong machine for sessions,
        // and target files come from PRK's own `@` list. Keep only its `/` command part: delegate only lines that start
        // with `/`, never forced (force skips commands and completes paths, e.g. `/pro` -> the Gateway's /proc). Its `@`
        // attachment search needs fd, which PRK never passes, so `/cmd @x` yields nothing either. Providers added via
        // addAutocompleteProvider wrap this base unchanged.
        const combined = new CombinedAutocompleteProvider(commands, ctx.session.sessionManager.getCwd());
        let provider: AutocompleteProvider = {
          getSuggestions: async (lines, line, col, options) => {
            const before = (lines[line] ?? "").slice(0, col);
            if (!before.trimStart().startsWith("/")) return null;
            return combined.getSuggestions(lines, line, col, { ...options, force: false });
          },
          applyCompletion: (lines, line, col, item, prefix) => combined.applyCompletion(lines, line, col, item, prefix),
        };
        for (const factory of ctx.autocompleteProviders) provider = factory(provider);
        ctx.autocompleteProvider = provider;
      }
      if (args.autocompleteOperation === "apply") return applyCompletion(ctx, ctx.autocompleteProvider, lines, cursorLine, cursorCol, args);
      ctx.completions.get(clientId)?.abort();
      const controller = new AbortController(); ctx.completions.set(clientId, controller);
      try {
        const data = await ctx.autocompleteProvider.getSuggestions(lines, cursorLine, cursorCol, { signal: controller.signal, force: args.force === true });
        return controller.signal.aborted ? { status: "cancelled" } : { status: "completed", data };
      } finally { if (ctx.completions.get(clientId) === controller) ctx.completions.delete(clientId); }
    
}
