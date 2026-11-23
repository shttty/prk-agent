import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { uiCaseTable, registerUiCases } from "./ui.ts";
import { createApiCases } from "./api.ts";
import { componentCases } from "./components.ts";
import { themeCases } from "./themes.ts";
import type { ProbeCase } from "./probe-types.ts";

export default function piUiProbe(pi: ExtensionAPI) {
  registerUiCases(pi);
  const cases: Record<string, ProbeCase> = { ...uiCaseTable, ...createApiCases(pi), ...componentCases, ...themeCases };
  pi.registerCommand("probe", {
    description: "Pi 1.6.0 UI coverage: /probe <case> [argument]",
    getArgumentCompletions: (prefix) => Object.keys(cases).filter((key) => key.startsWith(prefix)).map((key) => ({ value: key, label: key })),
    handler: async (args, ctx) => {
      const [name, ...rest] = args.trim().split(/\s+/);
      if (!name || name === "help") {
        ctx.ui.notify(Object.keys(cases).sort().join(" · "), "info");
        return;
      }
      const probe = cases[name];
      if (!probe) { ctx.ui.notify(`Unknown case: ${name}`, "error"); return; }
      await probe(ctx, rest.join(" "));
    },
  });
}
