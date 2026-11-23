import type { Extension, LoadExtensionsResult, ToolLoadout } from "@earendil-works/pi-coding-agent";
import { isLibraryCallback } from "../../../codemode/kernel-protocol/is-library-callback.ts";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import type { RuntimeContext } from "../runtime-state.ts";

/** Project only declaration-hook inputs; SDK registrations and executors remain untouched. */
export function projectExtensionDeclarations(ctx: RuntimeContext, loaded: LoadExtensionsResult): LoadExtensionsResult {
  return {
    ...loaded,
    get errors() { return loaded.errors; },
    extensions: loaded.extensions.map((extension): Extension => ({
      ...extension,
      get tools() {
        return new Map([...extension.tools].map(([name, tool]) => {
          const prepare = tool.definition.prepareLoadout;
          if (!prepare) return [name, tool];
          return [name, { ...tool, definition: { ...tool.definition, prepareLoadout(loadout: ToolLoadout) {
            const allowed = (candidate: { name: string }) => !isLibraryCallback(candidate.name) && toolEnabled(ctx, candidate.name);
            const changes = prepare.call(tool.definition, { ...loadout, declared: loadout.declared.filter(allowed),
              callable: loadout.callable.filter(allowed), registered: loadout.registered.filter(allowed) });
            return { ...changes, hiddenDeclarations: [
              ...loadout.declared.filter((candidate) => !allowed(candidate)).map((candidate) => candidate.name),
              ...(changes?.hiddenDeclarations ?? []),
            ] };
          } } }];
        }));
      },
    })),
  };
}
