import type { HostContext } from "../../host/host-state.ts";
import type { CapabilityCatalog } from "../../../config/capabilities/capability-types.ts";
import { kernelToolCatalog } from "../../../codemode/module-catalog/read-kernel-tool-catalog.ts";
import { readProviderErrors } from "../../../sessions/model-providers/read-provider-errors.ts";

export function mergeCapabilityCatalog(ctx: HostContext, catalog: CapabilityCatalog): void {
    if (ctx.lifecycle.closing) return;
    const key = (entry: CapabilityCatalog["entries"][number]) => `${entry.instance ?? ""}\0${entry.id}`;
    const entries = new Map(ctx.capabilities.globalCapabilityCatalog.entries.filter((entry) => !entry.id.startsWith("kernel:")).map((entry) => [key(entry), entry]));
    const candidates = new Map([...ctx.capabilities.globalCapabilityCatalog.entries, ...catalog.entries].map((entry) => [key(entry), entry]));
    const helpers = kernelToolCatalog(ctx.host.paths.home);
    const inspected = new Set(helpers.map((helper) => helper.module));
    for (const entry of catalog.entries) if (!entry.id.startsWith("kernel:") || (entry.pending && !inspected.has(entry.module))) entries.set(key(entry), entry);
    // The typed stubs are for the prompt; the capability catalog does not carry them.
    for (const { stub: _stub, types: _types, ...helper } of helpers) {
      const id = `kernel:${helper.name}`;
      const previous = candidates.get(`\0${id}`);
      if (previous) entries.set(`\0${id}`, { ...previous, ...helper, error: helper.error, pending: helper.pending, moduleOnly: helper.moduleOnly,
        description: `${helper.name}${helper.signature}\n${helper.description}`, source: helper.source ?? "PRK kernel prelude" });
    }
    ctx.capabilities.globalCapabilityCatalog = { ...ctx.capabilities.globalCapabilityCatalog, entries: [...entries.values()],
      providerErrors: readProviderErrors(catalog.providerErrors ?? [], ctx.capabilities.globalCapabilityCatalog.providerErrors) };
  }
